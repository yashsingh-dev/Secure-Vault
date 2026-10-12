# Rate Limiting: Architecture, Algorithms & Trade-offs

When you build a backend, rate limiting is your frontline bodyguard. Its job is simple: **stop spam, prevent DDoS, and kill brute-force attacks without annoying real users.**

Over time, developers created multiple core algorithms to solve this problem. Here is how each one works, why it was made, its hidden flaws, and where each shines.

---

## 1. Fixed Window Counter (The "Wall Clock" Reset)

### The Intuition
Imagine a door security guard who looks at a physical wall clock:
* **The rule:** *"You can only enter 5 times per hour."*
* Every time the clock strikes a new hour (`1:00`, `2:00`, `3:00`), the guard takes an eraser, wipes the chalkboard clean, and starts counting from zero again.

### How It Works Under the Hood
1. Divide time into fixed calendar buckets (e.g., `12:00 - 12:01`, `12:01 - 12:02`).
2. **Redis key:** `rl:login:<user_id>:<current_minute_timestamp>`
3. With every request, run `INCR`. If `counter > 5`, block the request.
4. Set key expiration to `windowTTL` (e.g., 60 seconds).

### The Big Flaw: The "Boundary Burst" Vulnerability
Because time is sliced into rigid blocks, an attacker can double the limit right at the boundary:
* **12:00:55 PM** &rarr; Attacker fires 5 requests *(All allowed)*.
* **12:01:00 PM** &rarr; Clock ticks. The bucket resets to 0!
* **12:01:05 PM** &rarr; Attacker fires 5 more requests *(All allowed)*.

> **Result:** The attacker pushed **10 requests in just 10 seconds**, even though your configured limit was *"5 requests per minute"*.

### Verdict
* **Pros:** Extremely fast, uses almost zero Redis memory (just 1 integer per user).
* **Cons:** Allows $2\times$ traffic bursts at the edges of time windows.
* **Best used for:** Low-risk, non-critical APIs where rough limits are fine.

---

## 2. Sliding Window Log (The "Every Exact Timestamp" Tracker)

### The Intuition
Imagine the guard doesn't care about the clock on the wall at all. Instead, whenever you step up to the door, the guard looks at their watch, writes down your **exact timestamp** in a notebook, looks back at the last 60 seconds of entries, and crosses out any timestamp older than 60 seconds.

If there are still 5 timestamps left in that moving 60-second window, you are blocked!

### How It Works Under the Hood
* **Redis data structure:** Sorted Set (`ZSET`).
* When a request arrives at timestamp $T$:
  1. Remove timestamps older than $T - \text{windowMS}$ using `ZREMRANGEBYSCORE`.
  2. Count how many items remain using `ZCARD`.
  3. If $\text{count} < \text{limit}$: add current timestamp $T$ using `ZADD` and allow.
  4. If $\text{count} \ge \text{limit}$: reject the request.

### The Problem: The "Memory Monster"
* Fixed Window stores one single integer per user.
* Sliding Window Log stores **every single request timestamp**.
* If a spammer or DDoS script fires 10,000 requests at your endpoint, Redis now has to store 10,000 timestamp elements inside a Sorted Set just for that single IP. Your Redis memory will blow up rapidly.

### Verdict
* **Pros:** 100% mathematically exact. Zero boundary burst bugs.
* **Cons:** Heavy Redis memory footprint, expensive computational overhead ($\mathcal{O}(\log N)$ sorting).
* **Best used for:** Very low-traffic, ultra-sensitive financial endpoints where absolute precision is worth the high memory cost.

---

## 3. Sliding Window Counter (The "Weighted Average" Sweet Spot)

### The Intuition
This is the golden middle ground. It gives you the **memory efficiency** of Fixed Window combined with the **burst protection** of Sliding Window Log.

Instead of tracking every single request timestamp, you only keep **two numbers**:
1. How many requests happened in the **previous window**?
2. How many requests have happened so far in the **current window**?

Then, you calculate a sliding percentage based on where you are in the current window.

### The Mental Math Formula
Suppose our window is 1 minute, and the limit is 10 requests:
* **Previous minute (12:00 - 12:01):** User made 8 requests.
* **Current minute (12:01 - 12:02):** It is currently 12:01:15 (15 seconds in &rarr; 25% through the minute).
* In this current minute, the user has made 2 requests so far.

Now, how many requests did the user make in the last rolling 60 seconds?
$$\text{Overlap with previous window} = 100\% - 25\% = 75\%$$
$$\text{Estimated hits} = (8 \times 0.75) + 2 = 6 + 2 = 8 \text{ requests}$$

Since $8 < 10$, the request is **allowed**!

### Why Cloudflare, Upstash, and Production APIs Love This
* **Memory friendly:** Stores only 2 small integers in Redis (`currentBucket` and `prevBucket`).
* **Smooths out spikes:** The boundary burst bug is completely neutralized because the previous window's weight pulls forward smoothly into the current window.
* **Accuracy:** Has an accuracy rate of ~99.9% while costing 99% less memory than Sliding Window Log.

### Verdict
* **Pros:** Production standard, practically zero memory overhead, no boundary spikes, lightning fast via a Redis Lua script.
* **Cons:** An estimate (a tiny micro-fraction of approximation, but completely acceptable in real-world engineering).
* **Best used for:** Modern web authentication, REST APIs, and microservices.

---

## 4. Token Bucket (The "Credit Refill" System)

### The Intuition
Imagine an arcade bucket that holds arcade tokens:
* The bucket has a maximum capacity (e.g., 5 tokens).
* A dispenser drops 1 new token into the bucket every 10 seconds (refill rate).
* Every time you play a game, you must drop 1 token into the machine.
* If you haven't played for a while, the bucket fills up to 5 tokens. You can immediately spend all 5 in a sudden burst!
* But once the bucket is empty, you are strictly limited to the refill speed (1 request every 10 seconds).

### Verdict
* **Pros:** Naturally accommodates legitimate user "bursts" (e.g., page loads that fetch 5 assets simultaneously) while enforcing a strict steady-state limit.
* **Cons:** Requires tracking floating-point refill math and last-refill timestamps.
* **Best used for:** AWS / Stripe-style API limits, public developer APIs, and network bandwidth throttling.

---

## 5. Leaky Bucket (The "Steady Drip" Queue)

### The Intuition
Imagine a bucket with a small hole in the bottom:
* Requests pour in from the top like water, at unpredictable speeds.
* Water leaks out the bottom hole at a strictly constant, steady drip.
* If water pours in faster than it can drip out, the bucket fills up.
* If the bucket overflows, extra incoming water simply spills onto the floor (requests get dropped).

### Verdict
* **Pros:** Guarantees a perfectly flat, smoothed-out rate of traffic hitting your database; zero traffic spikes.
* **Cons:** Bursty requests can get queued or dropped even if your server has plenty of idle capacity.
* **Best used for:** E-commerce checkout queues, video transcoding pipelines, and protecting fragile third-party payment gateways.

---

## Algorithm Comparison Matrix

| Algorithm | Redis Memory Usage | CPU / Complexity | Prevents Boundary Bursts? | Handles Traffic Bursts? | Ideal Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fixed Window** | 🟢 Minimal *(1 key)* | 🟢 $\mathcal{O}(1)$ Instant | ❌ No *(2x Vulnerability)* | ❌ Poor | Non-critical, internal / low-risk tools |
| **Sliding Log** | 🔴 High *(every request)* | 🔴 $\mathcal{O}(\log N)$ Heavy | 🟢 Yes *(100% exact)* | ⚠️ Strict | High-security financial transactions |
| **Sliding Window Counter** *(Our Choice)* | 🟢 Minimal *(2 keys)* | 🟢 $\mathcal{O}(1)$ Lua Script | 🟢 Yes *(Smoothed estimate)* | ⚠️ Good | Modern User Auth, OTP, Users, REST APIs |
| **Token Bucket** | 🟡 Low *(count + timestamp)* | 🟡 Moderate | 🟢 Yes | 🟢 Great *(Burst allowed up to bucket capacity)* | Public Developer APIs *(Stripe, GitHub)* |
| **Leaky Bucket** | 🟡 Low *(Queue / timestamp)* | 🟡 Moderate | 🟢 Yes | ❌ Destructive | E-commerce queues, payment processing |
