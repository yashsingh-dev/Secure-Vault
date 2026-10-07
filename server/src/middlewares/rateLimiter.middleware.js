import { checkSlidingWindowRateLimit } from '../services/v1/rateLimiter.service.js';
import response from '../utils/response.utils.js';
import { logger } from '../lib/logger.js';

/**
 * Creates an Express middleware enforcing the Sliding Window Counter rate limit.
 *
 * @param {object} config
 * @param {string} config.prefix - Namespace for the Redis key (e.g. 'auth:login')
 * @param {number} config.limit - Maximum requests allowed in the window (default 10)
 * @param {number} config.windowMs - Window time in ms (default 15 minutes)
 * @param {string} [config.message] - Custom message on rate limit exceeded
 * @param {function} [config.keyGenerator] - Optional custom key generator function (req => string)
 */
export const createRateLimiter = ({
    prefix,
    limit = 10,
    windowMs = 15 * 60 * 1000,
    message = 'Too many requests. Please try again later.',
    keyGenerator
}) => {
    return async (req, res, next) => {
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

        const redisKey = `rl:${prefix}:${identifier}`;

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

            logger.warn({ ip: identifier, prefix, limit, retryAfterSeconds }, 'Rate limit exceeded by client');

            return response(res, 429, message, {
                retryAfter: retryAfterSeconds
            });
        }

        next();
    };
};

export default createRateLimiter;
