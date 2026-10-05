import { describe, it, expect, vi } from 'vitest';
import { validate } from '../../../src/middlewares/validate.middleware.js';
import { z } from 'zod';

describe('Unit: validate.middleware', () => {
    const testSchema = z.object({
        email: z.string().email(),
        rememberMe: z.boolean().default(false)
    });

    it('should call next() and assign parsed/sanitized data to req.body on valid input', () => {
        const middleware = validate(testSchema);
        const req = {
            body: {
                email: 'test@example.com'
            }
        };
        const res = {};
        const next = vi.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(); // called without error
        expect(req.body.rememberMe).toBe(false); // default applied
    });

    it('should forward ApiError to next() on validation failure', () => {
        const middleware = validate(testSchema);
        const req = {
            body: {
                email: 'not-an-email'
            }
        };
        const res = {};
        const next = vi.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        const errorPassed = next.mock.calls[0][0];
        expect(errorPassed).toBeDefined();
        expect(errorPassed.statusCode).toBe(400);
    });
});
