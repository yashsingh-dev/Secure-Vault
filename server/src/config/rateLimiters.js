import createRateLimiter from '../middlewares/rateLimiter.middleware.js';

/**
 * 1. Login Rate Limiters:
 *    - Burst: Max 5 attempts per 1 minute (stops fast automated scripts)
 *    - Sustained: Max 10 attempts per 5 minutes (stops slow credential brute-force)
 */
export const loginBurstLimiter = createRateLimiter({
    prefix: 'auth:login:1m',
    limit: 5,
    windowMs: 1 * 60 * 1000,
    message: 'Too many login attempts. Please wait 1 minute before trying again.'
});

export const loginSustainedLimiter = createRateLimiter({
    prefix: 'auth:login:5m',
    limit: 10,
    windowMs: 5 * 60 * 1000,
    message: 'Too many login attempts. Please wait 5 minutes before trying again.'
});

/**
 * 2. Registration Rate Limiter:
 *    - Max 5 registrations per 1 hour per IP (stops bot account creation)
 */
export const registerLimiter = createRateLimiter({
    prefix: 'auth:register:1h',
    limit: 5,
    windowMs: 60 * 60 * 1000,
    message: 'Too many accounts registered from this IP. Please try again in an hour.'
});

/**
 * 3. OTP & Password Reset Limiters (Keyed by Email):
 *    - Max 3 requests per 15 minutes per email (stops email inbox flooding & SMS costs)
 */
export const otpLimiter = createRateLimiter({
    prefix: 'auth:otp:15m',
    limit: 3,
    windowMs: 15 * 60 * 1000,
    message: 'Too many verification codes requested for this email. Please wait 15 minutes.',
    keyGenerator: (req) => req.body?.email?.toString().trim().toLowerCase() || req.ip
});

/**
 * 4. Token Refresh Limiter:
 *    - Max 30 refresh requests per 1 minute per IP (prevents token refresh spam)
 */
export const refreshLimiter = createRateLimiter({
    prefix: 'auth:refresh:1m',
    limit: 30,
    windowMs: 1 * 60 * 1000,
    message: 'Too many token refresh requests. Please slow down.'
});
