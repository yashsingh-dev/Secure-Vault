# How I Built My Auth System (Step-by-Step Developer Notes)

> **Note:** I am the sole developer building and improving this project alongside my AI assistant. This project is not running in production yet, so I don't know exactly how it will behave under real-world scale, but I plan to deploy it live on Render (or a similar cloud platform) for testing and experiment purposes. There is currently no real user audience for it.

When I started this project, I didn't just write all this auth code in one go. I started with very basic stuff, faced real problems, got stuck, and then improved it step by step with my AI assistant.

Here is my exact journey and why each part exists in my codebase.

---

### Step 1: Just a Basic JWT Access Token

#### What I did:
User sends email and password. Password matches in DB, so I sign a JWT access token and send it back. Client sends this token in header/cookie on every request. Server just does `jwt.verify(token)` and lets the user in.

#### The Problem (Cons) - Why this failed:
1. **I cannot revoke it at all:** JWT is stateless. If user clicks "Logout", or if token gets leaked, there is no way for my server to kill it! The token will keep working until its expiry time.
2. **If I set expiry to 7 days:** Anyone who steals that token has full access to the account for 7 whole days. My server cannot do anything because it doesn't even check DB.
3. **No tracking:** I don't even know which device is logged in or how many people are using the same account.

#### Good things (Pros):
* Super fast. Server doesn't touch DB to check auth on every API call.
* Very easy to code.

---

### Step 2: Make Access Token Expiry Very Short (10 mins)

#### What I did:
To fix the problem where a stolen token works for 7 days, I changed the expiry to 10 minutes (`ACCESS_TOKEN: '10m'`).

#### The Problem (Cons) - Why this failed:
* **Worst User Experience ever:** When using the website, exactly after 10 minutes, every API starts giving a 401 error. The user has to type email and password again and again every 10 minutes. Nobody would use my app like this.

#### Good things (Pros):
* If token gets stolen, attacker only has 10 minutes max. After that, token is dead.

---

### Step 3: Enter the Refresh Token (Access + Refresh Token)

#### What I did:
I split the logic into two tokens:
1. **Access Token:** Lives for 10 minutes only (used for API calls).
2. **Refresh Token:** Lives for 1 day or 7 days (only used to get a new access token).
When access token expires, frontend silently calls `/auth/token-refresh` in background and gets a new access token without asking the user for password.

#### The Problem (Cons) - Where to store Refresh Token?:
* **If I put it in `localStorage`:** Any bad npm package or XSS script can do `localStorage.getItem('refreshToken')` and steal it.
* **If I put it in normal cookies:** Browsers send cookies automatically on cross-site requests, so hackers can do CSRF attacks.

#### Good things (Pros):
* User stays logged in smoothly, and access token is still short-lived.

---

### Step 4: HttpOnly Cookies + CSRF Token Protection

#### What I did:
* I put my tokens inside **`httpOnly: true` cookies**. Now JavaScript running in browser cannot read the cookie at all! Even if someone injects script, they cannot steal the cookie via JS.
* Because cookies are sent automatically by browser, I added CSRF protection (`csrf-csrf`). Frontend fetches CSRF token from `/api/csrf-token` and sends it in `x-csrf-token` header for all POST/PUT/DELETE requests.

#### The Problem (Cons):
* Tokens are safe in cookies, but what if someone steals user laptop or intercepts network? Also, how do I show active sessions on dashboard if refresh tokens are not saved anywhere on my server?
* If I save raw refresh token in MongoDB, and someone hacks my MongoDB, they get all refresh tokens in plain text!

#### Good things (Pros):
* XSS cannot steal token via JS.
* CSRF attacks are blocked because attacker site cannot generate my CSRF token header.

---

### Step 5: Save Hashed Refresh Tokens in Database

#### What I did:
When creating refresh token, I hash it with SHA-256 (`secureHash(token)`) and store that hash in MongoDB (`refreshTokenModel`). The raw token is only with the user in cookie.

#### The Problem (Cons):
* Even though it's hashed in DB, if an attacker somehow copies the cookie from user's machine, attacker can keep using that same refresh token again and again until it expires in 7 days. Server will think it's the real user.

#### Good things (Pros):
* Even if hacker dumps my MongoDB database, they only get useless hashes, not real tokens.
* I now have records in DB, so I can count sessions and delete them if user wants to logout.

---

### Step 6: Refresh Token Rotation (RTR - One-time use)

#### What I did:
Rule: A refresh token can only be used once!
When client sends refresh token to get a new access token, I invalidate/rotate that refresh token and issue a brand new refresh token.

#### The Problem (Cons) - Race conditions in React:
* In React, when a page loads, it calls multiple APIs at the same time (e.g. `getProfile`, `getSessions`).
* If access token is expired, both APIs fail with 401 at the same second.
* Both API calls try to call `/auth/token-refresh` with the SAME old refresh token.
* First call succeeds and rotates token.
* Second call arrives 50ms later with the old token. Server sees "Wait, this token was already rotated! Someone is hacking!" and kicks the innocent user out!

#### Good things (Pros):
* Stolen refresh token cannot be reused forever.

---

### Step 7: Add Grace Period (10 Seconds)

#### What I did:
When a token is rotated, I don't delete it instantly. I mark `isRotated = true` and record `rotatedAt = Date.now()`.
* If a request comes with this rotated token within **10 seconds**, I say: "Okay, this is just concurrent requests from the same browser, let it pass."
* If a request comes with this rotated token **after 10 seconds**, I say: "Hacker is trying to reuse an old stolen token!"

#### The Problem (Cons) - Why my old logic was bad:
* When attack was detected after 10 seconds, my old code did:
  `await refreshTokenModel.deleteMany({ userId: user._id })`
* This killed ALL sessions of that user! If user had their laptop token leaked, their phone and tablet also got logged out. That was annoying for innocent devices.

#### Good things (Pros):
* Fixed React concurrent request bug completely.

---

### Step 8: Token Family Architecture (`familyId` - RFC 6819)

#### What I did:
Instead of treating all tokens of a user as one big group, I grouped them by **Token Family**:
* When user logs in on Laptop -> gets `familyId: F1`.
* When user logs in on Phone -> gets `familyId: F2`.
* When Laptop rotates token -> new token keeps `familyId: F1`.
* If someone tries to reuse old rotated token from Laptop after 10 seconds:
  ```js
  // I only delete the compromised family!
  await refreshTokenModel.deleteMany({ familyId: tokenDoc.familyId });
  ```

#### Why this is great:
* If Laptop token is attacked, only the Laptop session is destroyed.
* Phone (`F2`) is totally safe and stays logged in!
* Old rotated tokens stay in DB and MongoDB automatically cleans them up using TTL index (`expires: LONG_REFRESH_TOKEN_MS / 1000`).

---

### Step 9: Token Versioning & Blacklist (Instant Logout)

#### What I did:
* **For single device logout:** I save hash of current access token in `blacklistTokenModel` so it cannot be used anymore.
* **For "Logout from all devices":** I have `tokenVersion` number in User model. When user clicks "Logout from all devices", I just do `user.tokenVersion += 1`. All access tokens worldwide become invalid immediately because their `tokenVersion` doesn't match anymore.

---

### Step 10: Device Fingerprinting & Dashboard Session Manager

#### What I did:
In `refreshTokenModel`, I added:
* `ip` (client IP, handles localhost `::1` cleanly)
* `userAgent`
* `device` (Desktop / Mobile / Tablet)
* `browser` (Chrome, Safari, Firefox, Edge)
* `os` (macOS, Windows, iOS, Android, Linux)
* `lastActive` (updates whenever user visits)

On frontend dashboard:
* User can see all active devices logged into their account.
* User can see their "Current Device" tagged with green badge.
* User sees last 6 characters of session ID (`...dba8d6`).
* User can click "Revoke" on any specific session, and it deletes that device's token family without logging out their other devices!

---

### Step 11: 2FA & reCAPTCHA (Protecting the Front Door)

#### What I did:
Even the best token system is useless if bots guess passwords or attacker knows user password.
* Added 6-digit email OTP with cooldown and lockouts after 5 wrong attempts.
* Added "Always require OTP" user toggle for high security.
* Added Google reCAPTCHA v2/v3 on login/register to stop brute-force scripts.

---

### Summary Checklist

| Feature | Where it is in code | What problem it solved |
|---|---|---|
| Short Access Token (10m) | `constants.js` | Stolen access token dies quickly |
| Refresh Token in HttpOnly Cookie | `setCookies.utils.js` | JS cannot steal token (No XSS) |
| CSRF Protection | `csrf.middleware.js`, `app.js` | Blocks unauthorized cross-origin requests |
| Hashed Refresh Tokens in DB | `refreshToken.model.js` | DB leak doesn't expose real tokens |
| Rotation + 10s Grace Period | `auth.service.js` | Stops token replay + fixes React race conditions |
| Token Family (`familyId`) | `refreshToken.model.js`, `auth.service.js` | Breach on one device won't kick out other devices |
| Token Version (`tokenVersion`) | `user.model.js`, `auth.middleware.js` | Instant "Logout from all devices" |
| Access Token Blacklist | `blacklistToken.model.js` | Instant single device logout |
| Device Fingerprint & Sessions | `device.utils.js`, `Dashboard.jsx` | User sees & controls all active logged-in devices |
| 2FA OTP + reCAPTCHA | `auth.service.js`, `recaptcha.middleware.js` | Stops brute-force bots and stolen password logins |
