# Architecture Enhancements & Advanced Guidelines

This document outlines architectural design proposals and advanced implementation guidelines for future iterations of **Secure Vault**. These are not currently active in production but provide complete architectural patterns for developers and contributors wishing to implement them.

---

## 1. Feature: Ephemeral Delivery Status Polling via Redis

### Problem
In an asynchronous queue architecture, the HTTP client receives a `200 OK` response before the third-party email provider (Resend) actually processes the delivery. If the email address is invalid, bounced, or the job is discarded after 3 failed attempts, the frontend user remains on the verification screen waiting for a code that will never arrive.

### Solution Overview
Store a lightweight, time-bounded status flag in Redis for each dispatched notification job. The client periodically polls this status while on the OTP input screen.

### Architecture Workflow
1. When generating an OTP, the API assigns a unique `jobId` and stores an initial status key in Redis:
   ```
   SET job:status:<jobId> "PENDING" EX 300
   ```
2. The API responds with:
   ```json
   {
     "success": true,
     "message": "Verification code dispatched.",
     "jobId": "cee3b084-714e-4478-a599-7eb3cf4d3237"
   }
   ```
3. As `customWorker.js` processes the job:
   * **On Success:** Updates Redis:
     ```
     SET job:status:<jobId> "DELIVERED" EX 60
     ```
   * **On Dead Letter Queue / Permanent Failure:** Updates Redis:
     ```
     SET job:status:<jobId> "FAILED: <error_message>" EX 120
     ```
4. **Client-Side Polling:**
   * The client polls `GET /api/v1/auth/otp-status/:jobId` every 3 seconds for up to 15 seconds.
   * If status is `"FAILED"`, the UI immediately alerts the user:
     > *"Unable to deliver email to this address. Please verify your email or click Resend."*
   * The UI resets the input screen without requiring the user to wait out the full 5-minute timeout.

---

## 2. Feature: Circuit Breaker & Multi-Provider Fallback Engine

### Problem
If the primary email provider (Resend) encounters a service outage, network partition, or consecutive `5xx` errors, every queued job will repeatedly fail, fill the processing queue, exhaust retry attempts, and cause high latency.

### Solution: The Circuit Breaker Pattern
Implement a 3-state Circuit Breaker (`CLOSED`, `OPEN`, `HALF-OPEN`) using Redis atomic counters:

```
                  +-----------------------------------+
                  |  Normal Operation (CLOSED State)  |
                  |     All traffic -> Resend API     |
                  +-----------------------------------+
                                    |
                    10 Consecutive 5xx/Network Failures
                                    v
                  +-----------------------------------+
                  |      Circuit Tripped (OPEN)       |
                  |  Resend bypassed for 60 seconds   |
                  |    All traffic -> Secondary SES   |
                  +-----------------------------------+
                                    |
                          60s Cooldown Expires
                                    v
                  +-----------------------------------+
                  |      Probing (HALF-OPEN)          |
                  |  Send 1 probe email to Resend     |
                  +-----------------------------------+
                     /                             \
             Probe Succeeds                   Probe Fails
                   /                                 \
  +---------------------------------+  +-------------------------------+
  |   Reset Circuit to CLOSED       |  | Re-trip to OPEN for 60 seconds|
  | Resend resumes primary traffic  |  | Traffic stays on Secondary SES|
  +---------------------------------+  +-------------------------------+
```

### Technical Design Specification
1. **Consecutive Error Counter:**
   * Key: `provider:resend:consecutive_errors`
   * Incremented on any `5xx`, socket timeout, or connection refused error.
   * Cleared back to `0` upon any successful dispatch (`200 OK`).
2. **Circuit Trip Condition:**
   * When `provider:resend:consecutive_errors >= 10`:
     ```javascript
     await redis.set('circuit:resend:state', 'OPEN', 'EX', 60);
     ```
3. **Dispatch Routing:**
   * Before dispatching, `jobDispatcher.js` checks:
     ```javascript
     const circuitState = await redis.get('circuit:resend:state');
     if (circuitState === 'OPEN') {
         // Bypass Resend completely, dispatch via AWS SES / SendGrid
         return await sendViaSecondaryProvider(job);
     }
     ```
4. **Benefits:**
   * Eliminates cascading delays and socket timeouts during outages.
   * Guarantees zero downtime for critical authentication OTPs.
