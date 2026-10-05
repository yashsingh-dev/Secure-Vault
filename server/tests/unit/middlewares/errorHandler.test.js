import { describe, it, expect, vi } from 'vitest';
import errorHandler from '../../../src/middlewares/errorHandler.middleware.js';
import ApiError from '../../../src/utils/ApiError.js';

describe('Unit: errorHandler.middleware', () => {
    const mockReq = { log: { warn: vi.fn(), error: vi.fn() } };

    it('should format ApiError with appropriate status and message', () => {
        const err = new ApiError(403, 'Permission denied');
        const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        const next = vi.fn();

        errorHandler(err, mockReq, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Permission denied',
            success: false,
            payload: null
        }));
    });

    it('should map TokenExpiredError to 401', () => {
        const err = new Error('jwt expired');
        err.name = 'TokenExpiredError';

        const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };

        errorHandler(err, mockReq, res, vi.fn());

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Your session has expired. Please sign in again.'
        }));
    });

    it('should map Mongo duplicate key 11000 to 409', () => {
        const err = new Error('E11000 duplicate key error');
        err.code = 11000;
        err.keyValue = { email: 'duplicate@example.com' };

        const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };

        errorHandler(err, mockReq, res, vi.fn());

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'An account with this email already exists. Please sign in instead.'
        }));
    });
});
