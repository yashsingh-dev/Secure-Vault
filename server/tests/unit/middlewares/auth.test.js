import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate } from '../../../src/middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';
import { safeRedis } from '../../../src/db/redis.js';

describe('Unit: auth.middleware (authenticate)', () => {
    const mockUserId = '64f1a2b3c4d5e6f7a8b9c0d1';
    const mockFamilyId = 'family-uuid-123';
    const secret = process.env.JWT_ACCESS_KEY || 'default-key';

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should forward 401 ApiError to next() if access token cookie is missing', async () => {
        const req = { cookies: {} };
        const res = {};
        const next = vi.fn();

        await authenticate(req, res, next);

        expect(next).toHaveBeenCalled();
        const err = next.mock.calls[0][0];
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Access Token Missing');
    });

    it('should forward 403 ApiError to next() if access token is blacklisted in Redis', async () => {
        const token = jwt.sign({ _id: mockUserId, tokenVersion: 1, familyId: mockFamilyId }, secret);
        const req = { cookies: { '__Host-sv_at': token } };
        const res = { clearCookie: vi.fn() };
        const next = vi.fn();

        vi.spyOn(safeRedis, 'exists').mockResolvedValue(true); // Blacklisted!

        await authenticate(req, res, next);

        expect(next).toHaveBeenCalled();
        const err = next.mock.calls[0][0];
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(403);
        expect(err.message).toBe('Session has been revoked. Please sign in again.');
    });

    it('should pass and attach user to req if token and session are valid', async () => {
        const token = jwt.sign({ _id: mockUserId, tokenVersion: 1, familyId: mockFamilyId }, secret);
        const req = { cookies: { '__Host-sv_at': token } };
        const res = { clearCookie: vi.fn() };
        const next = vi.fn();

        vi.spyOn(safeRedis, 'exists').mockImplementation(async (key) => {
            if (key.startsWith('blacklist:')) return false;
            if (key.startsWith('session:')) return true;
            return false;
        });
        vi.spyOn(safeRedis, 'getJson').mockResolvedValue({
            tokenVersion: 1
        });

        await authenticate(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.user).toBe(mockUserId);
        expect(req.tokenVersion).toBe(1);
    });

    it('should forward 401 ApiError to next() if tokenVersion in cache does not match token', async () => {
        const token = jwt.sign({ _id: mockUserId, tokenVersion: 1, familyId: mockFamilyId }, secret);
        const req = { cookies: { '__Host-sv_at': token } };
        const res = { clearCookie: vi.fn() };
        const next = vi.fn();

        vi.spyOn(safeRedis, 'exists').mockResolvedValue(false);
        vi.spyOn(safeRedis, 'getJson').mockResolvedValue({
            tokenVersion: 2 // Changed / Incremented!
        });

        await authenticate(req, res, next);

        expect(next).toHaveBeenCalled();
        const err = next.mock.calls[0][0];
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Session has ended. Please sign in again.');
    });
});
