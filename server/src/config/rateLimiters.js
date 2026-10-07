import createRateLimiter from '../middlewares/rateLimiter.middleware.js';

/**
 * Standard Production & OWASP Rate Limit Configurations
 *
 * Designed to balance genuine user UX with strong protection against:
 * - Credential stuffing & brute-force (Login)
 * - Bot mass registration (Register)
 * - SMS / Email toll fraud & inbox flooding (OTP Send)
 * - OTP brute-forcing (OTP Verify)
 * - Account takeover & token flooding (Password Reset)
 */

// 1. Login Burst: Max 5 attempts per 1 min (stops fast automated scripts)
export const loginBurstLimiter = createRateLimiter({
    name: 'auth:login:burst',
    limit: 5,
    windowMs: 1 * 60 * 1000,
    message: (d) => `Too many login attempts. Please wait ${d} before trying again.`
});

// 2. Login Sustained: Max 10 attempts per 5 mins (stops slow distributed brute force)
export const loginSustainedLimiter = createRateLimiter({
    name: 'auth:login:sustained',
    limit: 10,
    windowMs: 5 * 60 * 1000,
    message: (d) => `Too many login attempts. Please wait ${d} before trying again.`
});

// 3. Google OAuth: Max 10 requests per 1 min (prevents OAuth exchange spam)
export const googleAuthLimiter = createRateLimiter({
    name: 'auth:google',
    limit: 10,
    windowMs: 1 * 60 * 1000,
    message: (d) => `Too many Google sign-in attempts. Please wait ${d} before trying again.`
});

// 4. Registration: Max 5 registrations per 1 hour per IP (stops bot farm signups)
export const registerLimiter = createRateLimiter({
    name: 'auth:register',
    limit: 5,
    windowMs: 60 * 60 * 1000,
    message: (d) => `Too many account registration attempts. Please wait ${d} before trying again.`
});

// 5. Send OTP: Max 5 requests per 10 mins per email (stops inbox spamming & toll costs)
export const otpSendLimiter = createRateLimiter({
    name: 'auth:otp:send',
    limit: 5,
    windowMs: 10 * 60 * 1000,
    keyGenerator: (req) => req.body?.email?.toString().trim().toLowerCase() || req.ip,
    message: (d) => `Too many verification codes requested for this email. Please wait ${d} before requesting another code.`
});

// 6. Verify OTP (Registration & Reset): Max 10 verification attempts per 10 mins per email (stops 6-digit brute force)
export const otpVerifyLimiter = createRateLimiter({
    name: 'auth:otp:verify',
    limit: 10,
    windowMs: 10 * 60 * 1000,
    keyGenerator: (req) => req.body?.email?.toString().trim().toLowerCase() || req.ip,
    message: (d) => `Too many verification attempts for this code. Please wait ${d} before trying again.`
});

// 7. Password Reset: Max 5 password reset submissions per 1 hour per email
export const passwordResetLimiter = createRateLimiter({
    name: 'auth:password:reset',
    limit: 5,
    windowMs: 60 * 60 * 1000,
    keyGenerator: (req) => req.body?.email?.toString().trim().toLowerCase() || req.ip,
    message: (d) => `Too many password reset attempts. Please wait ${d} before trying again.`
});

// 8. Token Refresh: Max 20 refresh calls per 1 min per IP (prevents token endpoint hammering)
export const refreshLimiter = createRateLimiter({
    name: 'auth:refresh',
    limit: 20,
    windowMs: 1 * 60 * 1000,
    message: (d) => `Too many token refresh requests. Please wait ${d} before trying again.`
});

// 9. Session / Account Actions: Max 30 actions per 1 min per IP
export const sessionActionLimiter = createRateLimiter({
    name: 'auth:session',
    limit: 30,
    windowMs: 1 * 60 * 1000,
    message: (d) => `Too many session requests. Please wait ${d} before trying again.`
});

// 10. Global Limiter: General DDoS & endpoint protection (Max 300 requests per 5 mins per IP)
export const globalLimiter = createRateLimiter({
    name: 'global',
    limit: 300,
    windowMs: 5 * 60 * 1000,
    message: (d) => `Too many requests from this IP. Please try again in ${d}.`
});

const RateLimit = {
    globalLimiter,
    loginBurstLimiter,
    loginSustainedLimiter,
    googleAuthLimiter,
    registerLimiter,
    otpSendLimiter,
    otpVerifyLimiter,
    passwordResetLimiter,
    refreshLimiter,
    sessionActionLimiter
};

export default RateLimit;

