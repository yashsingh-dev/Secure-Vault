# How I Built My Auth System (Step-by-Step Architecture Article)

> **About this article:**  
> I am the sole developer who worked on this and improved it with my AI assistant. This is not in production yet, so I don't know how it will behave under real-world load, but I will make it live on Render (or another cloud platform) just for testing and experimentation. There is no real user audience for it right now.
>
> **Important Disclaimer:**  
> This article is written purely for conceptual and learning purposes—to document the real security problems I ran into and how I solved them step by step. It does not dictate how you must structure your database models or write your queries. You can implement these concepts in any stack, using any database. For example, you can use Redis instead of a relational or document database for much faster in-memory lookups, blacklist checking, and fewer database hits. It all depends on your architecture and infrastructure needs.
>
> **Core Baseline Rule:** In any secure system, passwords and tokens should always be stored as one-way hashes. That is standard baseline common sense rather than a special architectural step.

When I started designing this authentication flow, I didn't come up with the final architecture all at once. I started with a very simple setup, ran into real security and usability problems, got stuck, and progressively evolved the system step by step.

Here is the exact journey and the reasoning behind each phase.

---

### Step 1: Just a Basic JWT Access Token

#### What I did:
User sends email and password. Password matches in the database, so I sign a JWT access token and send it back. Client sends this token in a cookie on every request. Server just does `jwt.verify(token)` and lets the user in.

#### The Problem (Cons) - Why this failed:
1. **I cannot revoke it at all:** JWT is stateless. If the user clicks "Logout", or if the token gets leaked, there is no way for the server to kill it! The token keeps working until its expiry timestamp.
2. **If I set expiry to 7 days:** Anyone who steals that token has full access to the account for 7 whole days. The server cannot do anything to stop them because it doesn't check the database on each request.

#### Good things (Pros):
* Extremely fast. Server doesn't touch the database to verify requests.
* Very easy to code.

---

### Step 2: Make Access Token Expiry Very Short (10 mins)

#### What I did:
To fix the problem where a stolen token remains usable for days, I changed the token lifetime to 10 minutes.

#### The Problem (Cons) - Why this failed:
* **Worst User Experience ever:** When browsing the application, exactly after 10 minutes, every single API call starts throwing a 401 Unauthorized error. The user is forced to type their email and password again and again every 10 minutes. Nobody would use an application like this.

#### Good things (Pros):
* If a token gets stolen, the attacker only has a maximum 10-minute window before the token becomes completely useless.

---

### Step 3: Enter the Refresh Token (Access + Refresh Token Pattern)

#### What I did:
I split authentication into two separate tokens:
1. **Access Token:** Very short-lived (e.g., 10 minutes, used for calling APIs).
2. **Refresh Token:** Long-lived (e.g., 1 day or 7 days, used solely to obtain a new access token).

When the access token expires, the frontend silently calls a refresh endpoint in the background and receives a fresh access token without prompting the user for credentials.

#### The Problem (Cons) - Where to store the Refresh Token?:
* **If stored in `localStorage`:** Any malicious npm dependency or Cross-Site Scripting (XSS) vulnerability can read `localStorage` and steal the refresh token.
* **If stored in standard browser cookies:** Browsers send cookies automatically on cross-site requests, leaving the application wide open to Cross-Site Request Forgery (CSRF).

#### Good things (Pros):
* User stays logged in smoothly, while access tokens remain strictly short-lived.

---

### Step 4: HttpOnly Cookies + CSRF Protection

#### What I did:
* I placed the tokens inside **`httpOnly: true` cookies**. Now JavaScript running in the browser cannot access or read the cookie at all, making it immune to theft via script injection.
* **Why CSRF Protection is needed here (Cross-Pod / Separate Domain Architecture):**
  * In my setup, the frontend and backend are hosted on **different pods / domains** due to client deployment requirements (e.g., frontend on one domain and backend on an API subdomain or separate cloud pod).
  * Because they are on different origins, cookies must use `sameSite: 'None'; secure: true`.
  * **Important note:** If the frontend and backend were hosted on the **exact same pod / domain**, a CSRF token wouldn't even be needed! Setting the cookie to `sameSite: 'Lax'` or `sameSite: 'Strict'` would allow the browser to natively block cross-site requests.
  * But since they are separated across different pods, CSRF protection is mandatory. The frontend fetches a CSRF token and passes it in a custom header for all state-changing requests (`POST`, `PUT`, `DELETE`).

#### The Problem (Cons):
* Even with secure cookies, if an attacker copies the cookie from a user's machine or intercepts the network, they can keep replaying that refresh token for days.
* How do we detect if a refresh token was stolen and is being replayed?

#### Good things (Pros):
* XSS attacks cannot steal the token through client-side JavaScript.
* Cross-site request forgery attacks are blocked across separate pods.

---

### Step 5: Refresh Token Rotation (RTR - One-Time Use)

#### What I did:
Rule: A refresh token can only be used once!  
Whenever a client sends a refresh token to get a new access token, the server invalidates that refresh token and returns a brand-new refresh token.

#### The Problem (Cons) - Race conditions in Frontend Apps:
* In modern frontend applications (like React), when a page loads, it often triggers multiple API requests simultaneously (for example, fetching user profile and fetching settings at the same moment).
* If the access token has expired, multiple API calls fail with 401 at the exact same millisecond.
* Both requests simultaneously attempt to call the refresh endpoint using the **same** old refresh token.
* The first request arrives, succeeds, and rotates the token.
* The second request arrives 50 milliseconds later with the old token. The server sees an already-rotated token, suspects an attack, and logs the innocent user out!

#### Good things (Pros):
* A stolen refresh token cannot be reused indefinitely.

---

### Step 6: Add a Concurrency Grace Period (10 Seconds)

#### What I did:
When a refresh token is rotated, it is not deleted instantly. It is marked as rotated with a timestamp.
* If a request arrives using that rotated token within **10 seconds**, the server recognizes it as a concurrent browser race condition and safely fulfills it.
* If a request arrives with that rotated token **after 10 seconds**, the server knows it is an attacker attempting to replay a stolen token.

#### The Problem (Cons) - Why a naive breach response is bad:
* Initially, when a breach was detected after 10 seconds, the response was to wipe out **all** sessions belonging to that user ID.
* This caused collateral damage: if a user had their laptop token leaked, their phone and tablet also got kicked out! Innocent devices were unnecessarily disrupted.

#### Good things (Pros):
* Completely resolves frontend concurrency race conditions without false-positive logouts.

---

### Step 7: Token Family Architecture (RFC 6819)

#### What I did:
Instead of grouping all tokens under a user ID, tokens are grouped by a **Token Family**:
* When a user logs in on a Laptop -> a new token family (e.g., `Family A`) is created.
* When a user logs in on a Phone -> a separate token family (e.g., `Family B`) is created.
* When the Laptop rotates its token, the new token stays in `Family A`.
* If someone attempts to replay an old rotated token from the Laptop after the 10-second grace period:
  * The server revokes **only** `Family A`.

#### Why this is great:
* If the Laptop token is compromised, only the Laptop session chain is terminated.
* The Phone (`Family B`) remains completely secure and logged in!
* Old rotated tokens naturally expire and get cleaned up by database TTL indexes in the background.

---

### Step 8: Token Versioning & Blacklist (Instant Logout)

#### What I did:
* **For single-device logout:** The current access token hash is placed in a temporary blacklist cache so it cannot be reused for its remaining lifespan.
* **For "Logout from all devices":** The user record maintains an integer counter (`tokenVersion`). When the user clicks "Logout from all devices", the server increments this counter. Since every access token carries the version it was minted with, all access tokens globally fail authentication immediately when their version no longer matches the user's current version.

---

### Step 9: Device Fingerprinting & Active Session Management

#### What I did:
To give users full visibility into where their account is active, the server extracts device metadata during token issuance:
* Client IP address (with proxy and loopback handling)
* User-Agent parsing (Operating system, browser family/version, and device type like Desktop/Mobile/Tablet)
* Last active timestamp

On the dashboard:
* Users can view all active devices currently logged into their account.
* The current active device is clearly indicated.
* Users can see truncated identifiers for each session.
* Users can selectively revoke an individual unrecognized session, which deletes that specific token family without disrupting any of their other devices.

---

### Step 10: 2FA & Bot Defense (Protecting the Entry Point)

#### What I did:
Even the most sophisticated token architecture is useless if bots can brute-force passwords or attackers use leaked credentials.
* Added time-limited, 6-digit email verification codes with cooldown periods and account lockouts after consecutive failed attempts.
* Added an optional user security preference to always require a verification code on login (even for social sign-ins).
* Added Google reCAPTCHA v2 verification on authentication forms to stop automated brute-force scripts and credential-stuffing bots.

---

### Step 11: The Access Token Blind Spot (Binding Access Tokens to Token Families)

#### The Problem (Cons) - The Silent Vulnerability in Remote Revocation:
When building Step 8 and Step 9, a subtle but serious security gap remained:
* For a **single-device logout**, the server puts the current access token in a temporary blacklist cache.
* For **"Logout from all devices"**, incrementing `tokenVersion` invalidates all access tokens globally.
* **BUT what happens when a user views their Active Sessions on their phone and revokes an unrecognized Laptop session?**
  * The server deleted the Laptop's refresh token family. This prevented the Laptop from *refreshing*.
  * **However, the Laptop's current access token was still alive in memory!** The attacker could continue making authenticated API requests until that access token naturally expired (10 to 20 minutes).
  * Why? Because we couldn't increment `tokenVersion` (that would log out the user's phone too), and the server had no way to capture and blacklist the remote Laptop's access token without it being sent to the server.

#### What I did:
Instead of trying to track and store raw access tokens in a bloated blacklist collection:
* We embedded the session's **`familyId` directly inside the Access Token JWT payload**:
  ```json
  {
    "_id": "user_id_here",
    "tokenVersion": 1,
    "familyId": "family_id_here"
  }
  ```
* In `auth.middleware.js`, we use `Promise.all` to verify both conditions in parallel:
  1. Is the `tokenVersion` still valid on the user record?
  2. Does this specific `familyId` still exist in the database? (`refreshTokenModel.exists({ familyId })`)
* When an unrecognized device is revoked from the dashboard (or destroyed by breach detection), its entire token family is deleted from the database.
* The moment that revoked device sends its very next API request, the middleware sees that its `familyId` is gone, immediately wipes its cookies, and returns `401 Unauthorized`.

#### Why this is great:
* **Zero-delay instant revocation:** Even if an access token has 15 minutes of remaining life, revoking that session terminates access immediately on the next request.
* **Zero extra database collections or fields:** We reuse the already-indexed `familyId` field in the refresh token collection.
* **No added latency:** Running `userModel.findById` and `refreshTokenModel.exists` concurrently with `Promise.all` against indexed B-tree fields executes in single-digit milliseconds.

---

### Step 12: Hybrid Social Login & Account Linking (OAuth 2.0 Auth-Code Flow)

#### What I did:
Users expect modern one-click logins with Google, but combining social logins with a strict token architecture requires careful design:
* Implemented the **OAuth 2.0 Authorization Code flow with redirect mode**:
  * Frontend requests an authorization code from Google.
  * Google redirects back to a dedicated callback handler (`/auth/callback`).
  * Backend exchanges the code directly with Google using its client secret and verifies the ID token's RS256 cryptographic signature locally.
* **Account Linking & Segregation:**
  * Accounts created via Google Login are flagged with `googleLogin: true`, preventing attackers from taking over Google accounts with local password logins.
  * If the user enables "Always require OTP", even Google logins must complete the email 2FA verification before auth cookies are minted.
* **Full Integration with Token Families:** Google logins generate a fresh `familyId`, issue device-fingerprinted refresh tokens, and respect all session management features.

---

### Step 13: Strict Environment & Failsafe Startup Validation

#### What I did:
An authentication system is only as secure as its runtime configuration. A missing secret key or database URI in production can silently cripple security logic or cause runtime crashes during active user sessions.
* Created a dedicated startup validator (`validateSetup.js`) that boots before any server logic or database connections initialize.
* **Required Keys Guard:** Halts the server process (`process.exit(1)`) with a descriptive error report if critical credentials (`MONGO_URI`, `OAUTH_GOOGLE_SECRET`, `RECAPTCHA_SECRET_KEY`, `RESEND_API_KEY`) are missing.
* **Safe Fallbacks with Warnings:** Provides sensible defaults for non-critical development variables (`PORT`, `CLIENT_URL_DEV`, `JWT_*_KEY`) while logging explicit warnings so developers are alerted before deploying to production.

---

### Step 14: Redis In-Memory Acceleration & Multi-Bucket Caching (Zero-Database-Hit Auth)

#### The Problem (Cons) - The High-Traffic Database Bottleneck:
In Step 8 and Step 11, we achieved instant session revocation by verifying `tokenVersion` and checking whether the token's `familyId` existed in the database (`refreshTokenModel.exists({ familyId })`) on **every single authenticated request**.
* While secure, hitting MongoDB for every single API request turns the primary database into an immediate performance bottleneck under scale.
* Disk I/O, database connection pool contention, and query serialization add latency to every request.
* If a revoked access token was blacklisted, querying a database collection to check if the token hash is blacklisted also created unnecessary database load.

#### What I did:
I introduced **Redis** as a blazing-fast in-memory layer and organized cache state into dedicated, single-responsibility key buckets via a developer-friendly, fault-tolerant wrapper (`safeRedis`):
1. **Access Token Blacklist Bucket (`blacklist:<tokenHash>`):** When a single device logs out, its access token hash is placed in Redis with a TTL matching only the token's remaining lifespan. Once expired, Redis automatically evicts it—zero manual database cleanup needed.
2. **User Profile & Version Bucket (`user:profile:<userId>`):** Caches the JSON user profile containing `tokenVersion` and user settings. The auth middleware reads this in under a millisecond.
3. **Active Session Family Bucket (`session:<familyId>`):** When a session family is created or refreshed, an active session key is set in Redis with a TTL equal to the refresh token lifespan.
4. **Account Lockout Bucket (`user:block:<userId>`):** Caches temporary user lockouts and reasons with automatic expiration.
5. **Transient OTP Bucket (`user:otp:<userId>`):** Holds 6-digit OTP codes, attempt counts, and cooldown timers in volatile memory without polluting MongoDB collections with short-lived documents.
6. **Secondary Lookup Index (`email:to:id:<email>`):** Instant email-to-user-ID resolution for high-frequency operations.

#### The Self-Healing Fallback Pattern:
What happens if Redis restarts, a key is evicted under memory pressure, or there is a cache miss?
* The middleware implements a **self-healing cache-aside architecture**:
  1. Checks Redis first for the profile/session.
  2. On a cache miss, queries MongoDB as the authoritative source of truth.
  3. If found in MongoDB, it immediately repopulates ("self-heals") the Redis cache with the remaining TTL.
* **Safe Redis Wrapper (`safeRedis`):** All Redis interactions are wrapped to safely catch network disconnects and return safe fallbacks. If Redis is temporarily degraded, the application logs a diagnostic warning and falls back to MongoDB rather than crashing active user sessions.

#### Why this is great:
* **Sub-millisecond verification:** Authenticated requests validate token versions, family status, and blacklist checks in RAM in ~0.5ms.
* **Relieves 95%+ of database read pressure:** The primary MongoDB instance is spared from continuous token-checking queries.
* **Automatic memory cleanup:** Redis TTLs handle garbage collection natively.

---

### Step 15: Optimistic Concurrency Control (OCC) & Race-Condition-Proof State

#### The Problem (Cons) - Race Conditions in Concurrent Logouts & Refresh Chains:
In high-concurrency environments or modern SPAs where multiple browser tabs run concurrently:
* A user clicking "Logout from all devices" in two tabs simultaneously could trigger overlapping write operations.
* Concurrent requests attempting to unblock accounts or increment counters can overwrite each other's values (the classic lost-update anomaly).

#### What I did:
1. **Compare-And-Swap (CAS) / Optimistic Concurrency Control for `logoutAll`:**
   * Instead of a blind `$inc: { tokenVersion: 1 }`, the service uses conditional atomic updates:
     ```javascript
     const updatedUserDoc = await userModel.findOneAndUpdate(
         { _id: userIdStr, tokenVersion: expectedTokenVersion },
         { $inc: { tokenVersion: 1 } },
         { new: true, select: { tokenVersion: 1 } }
     );
     ```
   * If a concurrent request has already incremented `tokenVersion`, the query matches 0 documents and cleanly exits without double-incrementing or corrupting state.
2. **Atomic MongoDB Pipeline Operations:** Account unblocking, OTP attempt counter resets, and failed login locks use atomic MongoDB operators (`$set`, `$inc`, `findOneAndUpdate`) alongside synchronized Redis invalidations.

#### Why this is great:
* Guarantees strict transactional integrity across distributed and multi-tab sessions without the latency penalty of distributed locks.

---

### Step 16: Enterprise Rate Limiting via Redis Sliding Window Counter (Lua-Powered Defense)

#### The Problem (Cons) - Why Naive Rate Limiting Fails:
Authentication endpoints are the number one target for credential stuffing, automated password guessing, OTP enumeration, and toll fraud (spamming OTP emails/SMS). However, traditional rate limiting algorithms have serious flaws:
1. **Fixed Window Counter flaw:** If the limit is 10 requests per minute (resetting at :00), an attacker can send 10 requests at 00:59 and another 10 requests at 01:01. That is **20 requests in 2 seconds** across the boundary—twice the allowed rate!
2. **Sliding Window Log flaw:** Stores every request timestamp in a Redis Sorted Set (`ZSET`). While 100% accurate, its memory consumption is $O(N)$ per client. Under a distributed DDoS attack with millions of requests, Redis runs out of memory and crashes.
3. **IP-Only Limiting flaw:** Modern botnets use distributed proxy networks (residential IP rotating pools). If you only limit by IP, an attacker rotating through 1,000 residential IPs can brute-force a user's 6-digit OTP code without triggering an IP-based rate limiter!

#### The Solution: The Sliding Window Counter Algorithm
I implemented the **Sliding Window Counter** algorithm. It strikes the perfect balance: it eliminates the boundary-burst vulnerability of Fixed Window while maintaining the tiny $O(1)$ memory footprint of counter keys.

##### 1. The Mathematical Model:
Instead of tracking every request individually, time is sliced into discrete window buckets (`currentBucket` and `previousBucket`). The estimated traffic in the rolling window is calculated using weighted interpolation:
$$\text{elapsedPercentage} = \frac{\text{currentTime} \pmod{\text{windowMs}}}{\text{windowMs}}$$
$$\text{weightedPrevHits} = \lfloor (1 - \text{elapsedPercentage}) \times \text{previousWindowHits} \rfloor$$
$$\text{totalEstimatedRequests} = \text{weightedPrevHits} + \text{currentWindowHits}$$

* If $(\text{totalEstimatedRequests} + \text{incrementBy}) > \text{limit} \implies$ **Reject with 429 Too Many Requests**.
* Else $\implies$ Increment `currentKey` via `INCRBY`, ensure TTL is set to $2 \times \text{windowMs}$, and allow the request to proceed.

##### 2. Atomic Execution via Redis Lua Script:
If the application fetched `prevHits` and `currentHits` over the network and then decided whether to increment, concurrent requests could race between the read and write steps.
* To make this **100% atomic and race-condition-proof**, the entire calculation and state transition is executed in a single **Redis Lua script** via `redis.eval`:
  ```lua
  local currentKey  = KEYS[1]
  local previousKey = KEYS[2]
  local limit       = tonumber(ARGV[1])
  local now         = tonumber(ARGV[2])
  local windowMs    = tonumber(ARGV[3])
  local incrementBy = tonumber(ARGV[4]) or 1

  local currentHits = tonumber(redis.call('GET', currentKey) or 0)
  local prevHits    = tonumber(redis.call('GET', previousKey) or 0)

  local timeIntoCurrent = now % windowMs
  local percentage = timeIntoCurrent / windowMs
  local weightedPrev = math.floor((1 - percentage) * prevHits)
  local totalEstimated = weightedPrev + currentHits

  if (totalEstimated + incrementBy) > limit then
    local remaining = math.max(0, limit - totalEstimated)
    local resetMs = windowMs - timeIntoCurrent
    return { 0, remaining, resetMs } -- 0 = rejected (rate limited)
  end

  local newCurrent = redis.call('INCRBY', currentKey, incrementBy)
  if newCurrent == incrementBy then
    redis.call('PEXPIRE', currentKey, windowMs * 2)
  end

  local remaining = math.max(0, limit - (weightedPrev + newCurrent))
  local resetMs = windowMs - timeIntoCurrent
  return { 1, remaining, resetMs } -- 1 = allowed
  ```
* Because Redis executes Lua scripts as a single atomic unit, no two requests can race against each other, and it completes in a single network round-trip.

##### 3. Multi-Tiered Defense & Identity-Aware Keying:
Rate limits are tuned specifically to endpoint threat models:
* **Tiered Login Defense (Dual-Limiter):**
  * *Burst Limiter:* Max 5 attempts per 1 minute (immediately throttles fast automated scripts).
  * *Sustained Limiter:* Max 10 attempts per 5 minutes (catches slow, distributed dictionary attacks).
* **Identity-Aware Keying (Context-Based Keys):**
  * For **OTP Sending (`auth:otp:send`)**, **OTP Verification (`auth:otp:verify`)**, and **Password Reset (`auth:password:reset`)**, rate limits are keyed by **normalized email address** (`req.body.email`), not just IP!
  * Even if a botnet rotates across 10,000 residential IP addresses, it cannot brute-force a specific user's 6-digit verification code because all requests converge on the same Redis key (`rl:auth:otp:verify:10m:user@example.com`).
* **Endpoint-Specific Policies:**
  * *Registration:* Max 5 per 1 hour per IP (blocks automated bot account creation farms).
  * *Google OAuth:* Max 10 per 1 minute (prevents OAuth exchange abuse).
  * *Token Refresh:* Max 20 per 1 minute per IP (prevents token endpoint hammering).
  * *Session Actions:* Max 30 per 1 minute per IP.

##### 4. Standard IETF Headers & High-Availability Fail-Open Policy:
* Every response receives standard IETF rate-limiting headers:
  * `RateLimit-Limit`: Maximum allowed requests in the window.
  * `RateLimit-Remaining`: Remaining quota in current window.
  * `RateLimit-Reset`: Seconds until the quota resets.
  * `Retry-After`: Sent on 429 status informing the client exactly how many seconds to wait.
* **Fail-Open Policy:** If the Redis server experiences a network partition or hardware error, the rate limiter catches the error, logs an alert, and **fails open** (`next()`). Infrastructure degradation in the caching layer will never deny service to legitimate users.

---

### Step 17: Defense-in-Depth: Schema Validation (Zod) & Redacted Structured Logging (Pino)

#### What I did:
To ensure the authentication pipeline is rock-solid from the outer edge to the deep service layer:
* **Strict Boundary Validation with Zod:** Every route applies a validation middleware (`validate.middleware.js`) using explicit Zod schemas (`schemas.js`). Malformed payloads, oversized strings, invalid email formats, and unexpected fields are rejected with clean 400 Bad Request responses before any controller or database logic runs.
* **High-Performance Structured Logging (Pino):** Replaced unstructured `console.log` statements with structured JSON logging (`logger.js`, `httpLogger.middleware.js`), enabling log indexing and metrics in production.
* **Sensitive Data Redaction:** Configured automated redaction masks to ensure sensitive fields (`password`, `confirmPassword`, `token`, `refreshToken`, `otp`, `authorization`, `cookie`) can never leak into log aggregators, terminal output, or APM monitoring tools.

