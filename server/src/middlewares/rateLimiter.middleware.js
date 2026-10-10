import { checkSlidingWindowRateLimit } from '../services/rateLimiter.service.js';
import response from '../utils/response.utils.js';
import { logger } from '../lib/logger.js';
import { msToSuffix, msToHumanDuration } from '../lib/time.js';
import { CONSTANTS } from '../config/constants.js';
import REDIS_KEYS from '../config/redisKeys.js';

/**
 * Generates a clean, standardized Redis rate limit prefix based on a name and time window.
 * Example: generateRateLimitPrefix('auth:login', 60000) => 'auth:login:1m'
 *
 * @param {string} base - Base scope/name (e.g., 'auth:login', 'auth:otp')
 * @param {number} windowMs - Window duration in milliseconds
 * @returns {string} Standardized prefix
 */
export const generateRateLimitPrefix = (base, windowMs) => {
    const cleanBase = base?.replace(/:+$/, '') || 'default';
    return `${cleanBase}:${msToSuffix(windowMs)}`;
};

/**
 * Creates an Express middleware enforcing the Sliding Window Counter rate limit.
 * Automatically derives the Redis key prefix and default message from windowMs.
 * Can be globally enabled/disabled via CONSTANTS.RATE_LIMIT.ENABLED.
 *
 * @param {object} config
 * @param {string} [config.name] - Base name of the rate limiter (e.g. 'auth:login', 'auth:register')
 * @param {string} [config.prefix] - Explicit prefix (if provided, overrides automatic prefix generation)
 * @param {number} config.limit - Maximum requests allowed in the window (default 10)
 * @param {number} config.windowMs - Window time in ms (default 15 minutes)
 * @param {string} [config.message] - Custom message (if omitted, automatically generated)
 * @param {function} [config.keyGenerator] - Optional custom key generator function (req => string)
 */
export const createRateLimiter = ({
    name,
    prefix,
    limit = 10,
    windowMs = 15 * 60 * 1000,
    message,
    keyGenerator
}) => {
    // Automatically generate prefix if explicit prefix is not supplied
    const effectivePrefix = prefix || generateRateLimitPrefix(name || 'rate_limit', windowMs);
    const duration = msToHumanDuration(windowMs);
    const resolvedMessage = typeof message === 'function'
        ? message(duration, windowMs)
        : (message || `Too many requests. Please try again in ${duration}.`);

    return async (req, res, next) => {
        // If rate limiting is disabled (e.g., in development or via CONSTANTS.RATE_LIMIT.ENABLED = false), bypass
        if (!CONSTANTS.RATE_LIMIT.ENABLED) {
            return next();
        }
        // Resolve client identifier (Default: IP address, or custom key generator like email/userId)
        let identifier;
        if (typeof keyGenerator === 'function') {
            identifier = keyGenerator(req);
        } else {
            identifier = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                         req.socket?.remoteAddress ||
                         req.ip ||
                         'unknown_client';
        }

        const redisKey = REDIS_KEYS.rateLimit(effectivePrefix, identifier);

        const { success, remaining, resetMs } = await checkSlidingWindowRateLimit({
            key: redisKey,
            limit,
            windowMs
        });

        // Set standard IETF RateLimit-* HTTP headers
        res.setHeader('RateLimit-Limit', limit);
        res.setHeader('RateLimit-Remaining', remaining);
        res.setHeader('RateLimit-Reset', Math.ceil(resetMs / 1000));

        if (!success) {
            const retryAfterSeconds = Math.max(1, Math.ceil(resetMs / 1000));
            res.setHeader('Retry-After', retryAfterSeconds);

            logger.warn({ ip: identifier, prefix: effectivePrefix, limit, retryAfterSeconds }, 'Rate limit exceeded by client');

            return response(res, 429, resolvedMessage, {
                retryAfter: retryAfterSeconds
            });
        }

        next();
    };
};

export default createRateLimiter;
