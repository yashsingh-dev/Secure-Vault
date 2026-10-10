import { describe, it, expect, vi, beforeEach } from 'vitest';
import createRateLimiter from '../../../src/middlewares/rateLimiter.middleware.js';
import * as rateLimiterService from '../../../src/services/rateLimiter.service.js';
import { CONSTANTS } from '../../../src/config/constants.js';

describe('Unit: rateLimiter.middleware', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        CONSTANTS.RATE_LIMIT.ENABLED = true;
    });

    it('should bypass rate limiting and call next() immediately when RATE_LIMIT.ENABLED is false', async () => {
        CONSTANTS.RATE_LIMIT.ENABLED = false;
        const checkSpy = vi.spyOn(rateLimiterService, 'checkSlidingWindowRateLimit');

        const limiter = createRateLimiter({
            name: 'test',
            limit: 5,
            windowMs: 60000
        });

        const req = {};
        const res = {};
        const next = vi.fn();

        await limiter(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(checkSpy).not.toHaveBeenCalled();
    });

    it('should set RateLimit headers and call next() when request is within limit', async () => {
        vi.spyOn(rateLimiterService, 'checkSlidingWindowRateLimit').mockResolvedValue({
            success: true,
            remaining: 4,
            resetMs: 45000
        });

        const limiter = createRateLimiter({
            prefix: 'test',
            limit: 5,
            windowMs: 60000
        });

        const req = {
            headers: { 'x-forwarded-for': '127.0.0.1' },
            socket: {}
        };
        const res = {
            setHeader: vi.fn()
        };
        const next = vi.fn();

        await limiter(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Limit', 5);
        expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 4);
        expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Reset', 45);
    });

    it('should return 429 and Retry-After header when rate limit is exceeded', async () => {
        vi.spyOn(rateLimiterService, 'checkSlidingWindowRateLimit').mockResolvedValue({
            success: false,
            remaining: 0,
            resetMs: 30000
        });

        const limiter = createRateLimiter({
            prefix: 'test',
            limit: 5,
            windowMs: 60000,
            message: 'Too many test requests'
        });

        const req = {
            headers: { 'x-forwarded-for': '127.0.0.1' },
            socket: {}
        };
        const res = {
            setHeader: vi.fn(),
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        const next = vi.fn();

        await limiter(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 30);
        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Too many test requests',
            success: false,
            payload: { retryAfter: 30 }
        }));
    });

    it('should support custom keyGenerator for email or user based rate limiting', async () => {
        const checkSpy = vi.spyOn(rateLimiterService, 'checkSlidingWindowRateLimit').mockResolvedValue({
            success: true,
            remaining: 2,
            resetMs: 15000
        });

        const limiter = createRateLimiter({
            prefix: 'otp',
            limit: 3,
            windowMs: 60000,
            keyGenerator: (req) => req.body.email
        });

        const req = {
            body: { email: 'user@example.com' },
            headers: {},
            socket: {}
        };
        const res = { setHeader: vi.fn() };
        const next = vi.fn();

        await limiter(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(checkSpy).toHaveBeenCalledWith(expect.objectContaining({
            key: 'rl:otp:user@example.com'
        }));
    });

    it('should automatically generate prefix from name and windowMs if prefix is not given', async () => {
        const checkSpy = vi.spyOn(rateLimiterService, 'checkSlidingWindowRateLimit').mockResolvedValue({
            success: true,
            remaining: 9,
            resetMs: 60000
        });

        const limiter = createRateLimiter({
            name: 'auth:login:burst',
            limit: 10,
            windowMs: 60 * 1000 // 1m
        });

        const req = {
            headers: { 'x-forwarded-for': '192.168.1.100' },
            socket: {}
        };
        const res = { setHeader: vi.fn() };
        const next = vi.fn();

        await limiter(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(checkSpy).toHaveBeenCalledWith(expect.objectContaining({
            key: 'rl:auth:login:burst:1m:192.168.1.100'
        }));
    });
});
