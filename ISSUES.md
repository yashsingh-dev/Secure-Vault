# Active Project Issues & Technical Debt

> **RULE FOR THIS FILE:**  
> 1. This file tracks only **ACTIVE / PENDING** issues, bottlenecks, and technical debt that are not yet resolved.
> 2. Once an issue is fixed and verified, it **MUST be permanently removed** from this file to keep it clean and focused.

---

## 1. Bcrypt Threadpool Starvation & DoS via Concurrent Requests
- **Location**: [`server/src/services/v1/auth.service.js`](file:///Users/apple/Developer/My%20Code/Projects/Secure%20Vault/server/src/services/v1/auth.service.js) -> `login` (Password verification: `verifyHash`)
- **Root Cause**:
  `bcrypt` is computationally intensive by design and runs inside Node.js's underlying `libuv` worker threadpool (default capacity: 4 threads).
  Without a rate limiter or threshold before password verification, an attacker or rapid concurrent login requests can completely starve the threadpool, resulting in server-wide latency spikes or Denial of Service (DoS) for all users.
- **Planned Solution**:
  1. Implement rate limiting middleware (e.g., `express-rate-limit` or Redis-backed rate limiter) on sensitive authentication routes (`/login`, `/register`, `/verify-otp`).
  2. Implement an atomic failed login attempts counter with automatic temporary lockout after consecutive failed attempts.
  3. Optionally tune `UV_THREADPOOL_SIZE` in the environment if deployment infrastructure permits.

---

## 2. Duplicate Session Creation on Concurrent Login Requests
- **Location**: [`server/src/controllers/v1/auth.controller.js:29-39`](file:///Users/apple/Developer/My%20Code/Projects/Secure%20Vault/server/src/controllers/v1/auth.controller.js#L29-L39) & [`server/src/utils/setJwtToken.utils.js:42-52`](file:///Users/apple/Developer/My%20Code/Projects/Secure%20Vault/server/src/utils/setJwtToken.utils.js#L42-L52)
- **Problem & Front-End Impact**:
  When a user accidentally triggers multiple login requests at the same time (e.g. rapid clicks, multiple tabs), each request executes `generateRefreshToken()`, which mints a new `familyId` and persists a new document in `refreshTokenModel`.
  On the front-end dashboard, active sessions are fetched and displayed to the user. Because multiple refresh tokens were minted for the same device/browser at the same time, the user sees two or more duplicate active sessions for the exact same device, causing confusion.
- **Planned Solution**:
  1. **Database Session Check**: Before creating a brand new refresh token in `refreshTokenModel`, query the database for an existing active session belonging to the same user and client fingerprint (same device, browser, and IP).
  2. **Session Reuse / Invalidation**: Either reuse the existing token family/session or atomically revoke/supersede the previous session for that device before issuing the new one.
  3. **Concurrency Control**: Ensure the lookup and creation/update of the active session document are handled atomically to avoid duplicate inserts during concurrent bursts.

---

## 3. Registration Rollback Race & Asynchronous OTP Queue (Redis / BullMQ)
- **Location**: [`server/src/services/v1/auth.service.js:159-188`](file:///Users/apple/Developer/My%20Code/Projects/Secure%20Vault/server/src/services/v1/auth.service.js#L159-L188)
- **Problem & Front-End Impact**:
  Currently, user creation and email dispatch are executed synchronously within the same request lifecycle. If email sending fails or is delayed by SMTP timeouts, rolling back via `findByIdAndDelete` leaves a vulnerable race window where subsequent retry requests can be falsely told that the account already exists (`409 Conflict`), only for that account to vanish milliseconds later when the deletion completes.
- **Planned Solution**:
  1. Decouple OTP email dispatch from the HTTP request/response cycle by introducing an asynchronous job queue (e.g. Redis + BullMQ).
  2. Implement an automated retry mechanism with exponential backoff for failed email jobs instead of immediately deleting the registered user.
  3. Allow users to request an OTP resend via a dedicated endpoint if their initial email delivery experiences upstream delays.
