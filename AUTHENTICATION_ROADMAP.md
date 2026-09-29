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
* Added an optional user security preference to always require a verification code on login.
* Added reCAPTCHA verification on authentication forms to stop automated brute-force scripts and credential-stuffing bots.
