# MongoDB Internals: Query Optimizer, Indexing Strategies & Memory Physics

To write high-performance database queries and prevent production crashes, backend engineers must understand the physical mechanics of MongoDB: how the Query Optimizer audition plans, the physical differences between Sequential I/O (COLLSCAN) and Random I/O (IXSCAN + FETCH), B-Tree covered queries, WiredTiger 32KB page caching, LRU eviction cycles, and the 100MB Blocking Sort memory limit.

---

## Table of Contents
1. [The Query Optimizer (The "Brain")](#1-the-query-optimizer-the-brain)
2. [Access Strategies: COLLSCAN vs. IXSCAN](#2-access-strategies-collscan-vs-ixscan)
3. [The Fetch Phase & The Random I/O Bottleneck](#3-the-fetch-phase--the-random-io-bottleneck)
4. [Projection: The Art of Filtering & Covered Queries](#4-projection-the-art-of-filtering--covered-queries)
5. [RAM Management: WiredTiger Cache & LRU Eviction Physics](#5-ram-management-wiredtiger-cache--lru-eviction-physics)
6. [Sorting, Pagination & Memory Limits (The 100MB Wall)](#6-sorting-pagination--memory-limits-the-100mb-wall)
7. [Memory Architecture: WiredTiger Cache vs. Query Execution Memory](#7-memory-architecture-wiredtiger-cache-vs-query-execution-memory)
8. [Summary Reference Matrix](#8-summary-reference-matrix)

---

## 1. The Query Optimizer (The "Brain")

Before MongoDB reads a single byte from disk, the **Query Optimizer** builds an execution strategy.

```text
  [ Incoming Query Shape: { email: <string>, status: <string> } ]
                                 │
                                 ▼
                     [ Hold "The Audition" ]
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
   [ Candidate Plan A ]    [ Candidate Plan B ]    [ Candidate Plan C ]
   (Index: email)          (Index: status)         (Compound: email+status)
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                        (Race for ~few ms)
                                 │
                                 ▼
         [ Declare "Winning Plan" & Store in Plan Cache ]
```

### The Three Query Scenarios

#### Scenario 1: The "No-Index" Path (The Hard Way)
* **The Decision:** If no relevant indexes exist, the Optimizer has only one option: a **Collection Scan (`COLLSCAN`)**.
* **The Execution:** It instructs the storage engine to start at the first byte of the `.wt` collection file and evaluate every single document sequentially.
* **The Cost:** $\mathcal{O}(N)$ complexity. Regardless of CPU power, reading 10 million documents without an index requires a linear scan of disk pages.

#### Scenario 2: Single Index (The Straight Path)
* **The Decision:** For a query like `{ email: "yash@gmail.com" }`, the Optimizer inspects the collection catalog and finds a matching single-field index.
* **The Plan:** It selects an **Index Scan (`IXSCAN`)**.
* **The Fetch:** After finding the index leaf node in the B-Tree ($\mathcal{O}(\log N)$), it issues a `FETCH` using the retrieved `RecordID` to load the rest of the document fields from the `.wt` data file.

#### Scenario 3: Multiple / Compound Indexes (The "Audition")
Suppose a collection has:
1. An index on `email`
2. An index on `username`
3. A compound index on `{ email: 1, status: 1 }`

When running `{ email: "yash@gmail.com", status: "active" }`, the Optimizer does not guess which index is fastest. It holds an **Audition**:
1. **Candidate Plans:** It generates multiple candidate execution plans.
2. **The Race:** It executes each candidate plan in parallel for a few milliseconds or until a candidate produces the first batch of results.
3. **The Winning Plan:** The plan that yields the first results fastest wins the race.
4. **The Plan Cache:** The winner is saved in the **Plan Cache**. Subsequent queries with the same **Query Shape** skip the race and execute the winning plan immediately.

---

### Query Shapes & Plan Cache Invalidation

MongoDB does not cache plans based on literal values (e.g., `"yash@gmail.com"`). It caches plans based on the **Query Shape** (template):

```text
Query 1: { email: "alice@acme.com", status: "active" }  ──▶ Template: { email: <str>, status: <str> }
Query 2: { email: "bob@acme.com",   status: "pending" } ──▶ Matches identical cached shape!
```

#### When Does MongoDB Clear the Plan Cache and Re-audition?
1. **Index Mutations:** Adding or dropping any index on the collection invalidates the cache immediately.
2. **Server Reboot:** The Plan Cache lives purely in RAM and clears on process restart.
3. **The 10x Failure Threshold:** If a cached winning plan suddenly performs $10\times$ worse than its recorded benchmark, MongoDB marks it stale and triggers a new audition.
4. **Data Volatility Threshold (~20%):** When roughly 20% of the collection's data is updated, inserted, or deleted, the statistical distribution changes, prompting a fresh evaluation.

---

## 2. Access Strategies: COLLSCAN vs. IXSCAN

```text
  COLLSCAN (Sequential I/O):
  [ Disk ] ──▶ [ OS Read-Ahead Page Cache ] ──▶ [ Snappy Decompress ] ──▶ [ 32KB Page ] ──▶ [ Inspect BSON ]

  IXSCAN + FETCH (Random I/O):
  [ B-Tree Root ] ──▶ [ Internal Node ] ──▶ [ Leaf Node ] ──▶ [ RecordID (GPS Coord) ]
                                                                      │
                                                               (Random Disk Jump)
                                                                      ▼
                                                              [ 32KB Page in Data File ]
```

### 1. COLLSCAN: The Linear Sequential Journey
* **Catalog Lookup:** The engine consults `_mdb_catalog.wt` to map the collection namespace to its physical `.wt` file.
* **Sequential Read & OS Read-Ahead:** The engine streams the file sequentially. Modern OS kernels optimize sequential reads via **Read-Ahead**, pre-loading adjacent blocks into the OS Page Cache before MongoDB requests them.
* **Decompression Pipeline:** Compressed blocks are read from disk and decompressed by **Snappy** into standard **32KB in-memory pages**.
* **Cache Pollution Hazard:** Because every page must pass through the WiredTiger Cache, a large `COLLSCAN` sweeps through the cache, evicting active, frequently accessed index and document pages. A single unindexed query can degrade database performance cluster-wide.

---

### 2. IXSCAN: The Surgical B-Tree Strike
* **Traversal:** The engine navigates the B-Tree ($\text{Root} \rightarrow \text{Internal} \rightarrow \text{Leaf}$) in $\mathcal{O}(\log N)$ operations.
* **Index Bounds:** The query optimizer assigns explicit bounds (e.g., `["yash@gmail.com", "yash@gmail.com"]`). The engine jumps directly to the starting leaf and scans until the boundary ends.
* **The Output:** The index scan returns **`RecordID`s** (physical file byte offsets), not complete documents.

---

### 3. The "Tipping Point": Sequential vs. Random I/O

Why would a `COLLSCAN` ever be faster than an `IXSCAN`?

Suppose a collection has **1,000,000 users**, and **10,000 users** match your query:

| Metric | Scenario A: `IXSCAN` + `FETCH` | Scenario B: `COLLSCAN` |
| :--- | :--- | :--- |
| **Lookup Strategy** | Fast B-Tree scan to find 10,000 `RecordID`s. | Reads collection from start to finish. |
| **Data Access** | **10,000 Random I/O Jumps** across the data file. | **1 Continuous Sequential Read** stream. |
| **Disk Head Behavior** | Disk/SSD must service thousands of random addresses. | Modern NVMe/SSDs maximize throughput via sequential read-ahead. |

> [!IMPORTANT]
> **The Golden Rule of Index Selectivity & The Tipping Point:**
> * If a query matches **1% of total data**: `IXSCAN` wins decisively. The B-Tree navigation cost is tiny and few random fetches are needed.
> * If a query matches **50%–90% of total data** (e.g., `{ gender: "Female" }`): **`COLLSCAN` is significantly faster**. Performing 500,000 random seeks across a multi-gigabyte file takes far longer than reading the file once in a smooth sequential stream. The Query Optimizer actively bypasses low-selectivity indexes for this reason.

---

## 3. The Fetch Phase & The Random I/O Bottleneck

```text
  [ B-Tree Leaf Match ] ──▶ [ RecordID: File 12, Offset 0x4A20 ]
                                          │
                                          ▼
                         [ Check WiredTiger RAM Cache ]
                         ┌────────────────┴────────────────┐
                         ▼ HIT                             ▼ MISS (Page Fault)
             [ Instant Memory Read ]             [ Stop & Read SSD Block ]
                                                           │
                                                           ▼
                                                 [ Decompress into 32KB Page ]
```

1. **The `RecordID` (Data's GPS Coordinate):**  
   The `RecordID` is an internal coordinate pointer: *"Collection file `collection-4-*.wt`, Byte Offset `0x4A20`"*. WiredTiger translates this offset to identify which **32KB Page** holds the document.
2. **The Cache Check:**
   * **Cache Hit:** If the target 32KB page is already resident in the WiredTiger RAM cache, data access is near instantaneous.
   * **Cache Miss (Page Fault):** The engine pauses execution, initiates physical SSD I/O, decompresses the block, and maps it into RAM.
3. **The Fragmentation Penalty:**  
   If a collection undergoes frequent updates and deletions, documents become physically fragmented across disk sectors. Fetching 100 related documents might require reading 100 distinct 32KB pages, turning a 1ms index lookup into a **100ms+ physical I/O bottleneck**.

---

## 4. Projection: The Art of Filtering & Covered Queries

### The Invisible Overhead of Omitting Projections
When fetching documents without field projection (`find({ email: '...' })`):
* **Network & Node.js Memory:** A 100KB document containing 50 fields forces the database network card to push 100KB over TCP, and forces the V8 engine in Node.js to allocate heap memory and parse the entire object.
* **Database CPU BSON Skipping:** BSON is a **length-prefixed binary format**. To read the 50th field in an unprojected document, the MongoDB CPU must read the header and length-skip fields #1 through #49 sequentially. Using projection (`{ email: 1 }`) instructs the database CPU to exit processing as soon as it matches the projected keys.

---

### The Holy Grail: Covered Queries

In a **Covered Query**, MongoDB completely **skips the `FETCH` stage**.

```text
  STANDARD QUERY (IXSCAN + FETCH):
  [ B-Tree Index ] ──(Find RecordID)──▶ [ Read 32KB Data Page ] ──▶ [ Return Full BSON ]

  COVERED QUERY (IXSCAN Only - Zero Disk Touch):
  [ B-Tree Index ] ──(Index holds all requested fields)────────────▶ [ Return Directly to Wire ]
  * Data file is NEVER touched!
  * 32KB data page is NEVER loaded into RAM!
```

#### The Two Golden Rules for Covered Queries:
1. **Include All Query & Projection Fields in a Compound Index:**
   ```javascript
   // Compound Index:
   db.users.createIndex({ email: 1, username: 1, role: 1 });

   // Covered Query:
   db.users.find(
     { email: "yash@gmail.com" },
     { email: 1, username: 1, role: 1, _id: 0 }
   );
   ```
2. **Explicitly Exclude `_id: 0`:**  
   By default, MongoDB always projects `_id`. If `_id` is not part of your compound index and you do not set `_id: 0`, MongoDB is forced to execute a `FETCH` to retrieve `_id` from the data file, **breaking the covered query**.

---

## 5. RAM Management: WiredTiger Cache & LRU Eviction Physics

The WiredTiger Cache typically defaults to **50% of (RAM - 1GB)** (e.g., ~15.5 GB on a 32GB server).

```text
  WiredTiger RAM Cache Stack:
  ┌────────────────────────────────────────────────────────┐
  │ Top: Most Recently Used (MRU) Page                     │  ▲ Read / Touch moves to top
  ├────────────────────────────────────────────────────────┤
  │ ... active pages ...                                   │
  ├────────────────────────────────────────────────────────┤
  │ Bottom: Least Recently Used (LRU) Page                 │  ▼ Target for Eviction
  └────────────────────────────────────────────────────────┘
```

### LRU Eviction ("The Bouncer Policy")
* Every time a 32KB page is accessed, it moves to the top of the stack.
* When new pages must enter from SSD and the cache is full, the eviction thread evicts pages from the bottom of the stack.

### Clean vs. Dirty Pages
* **Clean Pages (Read-Only):** The page in RAM is identical to the block on disk. The eviction thread can drop it instantly with zero disk writes.
* **Dirty Pages (Modified in RAM):** The page has undergone updates/inserts that haven't been written to the 60-second checkpoint yet.
  * **Emergency Write Rule:** A dirty page **cannot be dropped**. If the eviction thread targets a dirty page, it initiates an emergency **reconciliation**, immediately writing the 32KB page to the `.wt` file before freeing the memory address.

---

## 6. Sorting, Pagination & Memory Limits (The 100MB Wall)

### Anatomy of an Unindexed "Slow" Query:
```javascript
Review.find({ isActive: true })
  .sort({ createdAt: -1 })
  .skip(10000)
  .limit(10);
```

```text
  1. COLLSCAN ──▶ 2. Result Set Copy ──▶ 3. Blocking Sort Buffer ──▶ 4. Linear Skip Count ──▶ 5. Limit 10
  (Read pages)    (Shallow copy)         (100MB RAM limit!)         (Iterate 1..10000)        (Emit to wire)
```

1. **`COLLSCAN`:** Reads pages from disk, uncompresses them into the WiredTiger Cache, and filters `isActive: true`.
2. **Reference Copy into Result Set:** Matching BSON bytes are shallow-copied into a working Result Set. The original 32KB page remains intact in the WiredTiger cache.
3. **The Blocking Sort (The "Work Bench"):**
   * The engine loads the Result Set into a **Sorting Buffer** inside **Query Execution Memory**.
   * It runs an $\mathcal{O}(N \log N)$ in-memory sort.
   * **The 100MB Memory Wall:** If the documents exceed **100MB**, MongoDB immediately halts and throws an error:
     ```text
     Executor error during find command :: caused by :: Sort memory limit exceeded (104857600 bytes)
     ```
4. **The `skip(10000)` Linear Iteration:** The CPU must linearly count from index 0 through 10,000 in the sorted array ($\mathcal{O}(N)$ pagination overhead).
5. **The `limit(10)` Extraction:** Only after counting past 10,000 does it slice the next 10 items to serialize as BSON for Node.js.

---

### The Solution: Non-Blocking Indexed Sorting

By creating a compound index on `{ isActive: 1, createdAt: -1 }`:
* **Zero In-Memory Sort:** The B-Tree leaf nodes are **already physically ordered** by `createdAt`.
* **Zero 100MB RAM Limit:** The query never touches the 100MB sorting buffer. You can paginate through billions of documents with flat, minimal memory overhead.
* **Surgical Fetching:** The engine skips the first 10,000 leaf pointers in the B-Tree and performs a `FETCH` **only for the 10 surviving documents**.

---

## 7. Memory Architecture: WiredTiger Cache vs. Query Execution Memory

A frequent point of confusion is where query operations actually occur in RAM:

```text
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                           TOTAL MONGODB SERVER RAM                              │
  │                                                                                 │
  │  ┌─────────────────────────────────────┐   ┌─────────────────────────────────┐  │
  │  │ WiredTiger RAM Cache (~50% RAM)     │   │ Query Execution Memory          │  │
  │  │ • Holds 32KB Data Pages             │   │ • Holds temporary Result Sets   │  │
  │  │ • Holds B-Tree Index Pages          │   │ • Holds 100MB Sorting Buffers   │  │
  │  │ • Manages LRU clean/dirty pages     │   │ • Aggregation pipeline memory   │  │
  │  └──────────────────┬──────────────────┘   └────────────────┬────────────────┘  │
  └─────────────────────┼───────────────────────────────────────┼───────────────────┘
                        │ (Shallow Byte Copy)                   │
                        └───────────────────────────────────────┘
```

* **WiredTiger RAM Cache:** Dedicated exclusively to storing data pages and index leaves in memory. Data here is shared across all concurrent queries and never mutated directly by sorting routines.
* **Query Execution Memory:** An independent allocation of RAM used for in-flight query operations (sorting buffers, hash aggregations, grouping tables).

### Assembly Line Post-Sort Optimizations:
If a query performs post-sort transformations (e.g., dynamic projections or redactions), MongoDB optimizes the pipeline:
1. It sorts the candidate documents inside the sorting buffer.
2. It executes `skip(10000)` by advancing the buffer pointer, **discarding the first 10,000 records without touching their fields**.
3. It applies transformations **only to the final 10 documents** that survive the `limit(10)` boundary, saving massive CPU cycles.

---

## 8. Summary Reference Matrix

| Dimension | `COLLSCAN` | `IXSCAN` + `FETCH` | Covered Query |
| :--- | :--- | :--- | :--- |
| **I/O Pattern** | Sequential I/O (Predictable read-ahead) | Random I/O (Jumping to RecordIDs) | **Zero Disk I/O** (Index leaf only) |
| **B-Tree Traversal** | None | Yes ($\mathcal{O}(\log N)$) | Yes ($\mathcal{O}(\log N)$) |
| **Data Page Access** | Loads all 32KB data pages | Loads matching 32KB data pages | **Never touches 32KB data pages** |
| **Memory Pressure** | High WiredTiger cache pollution | Moderate cache usage | **Minimal (Only index cache)** |
| **Sorting Behavior** | Blocking sort (100MB limit, $\mathcal{O}(N \log N)$) | Non-blocking sort if index matches sort prefix | **Non-blocking sort** |
| **Selectivity Requirement**| Best when matching $>50\%$ of dataset | Best when matching $<1\%-5\%$ of dataset | Best for high-frequency low-latency reads |
