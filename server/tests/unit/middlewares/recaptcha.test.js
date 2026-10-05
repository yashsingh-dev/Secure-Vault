import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyRecaptcha } from '../../../src/middlewares/recaptcha.middleware.js';
import * as recaptchaService from '../../../src/services/v1/recaptcha.service.js';

describe('Unit: recaptcha.middleware', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should forward ApiError to next() if no recaptcha token is supplied', async () => {
        const req = { body: {}, headers: {} };
        const res = {};
        const next = vi.fn();

        await verifyRecaptcha(req, res, next);

        expect(next).toHaveBeenCalled();
        const err = next.mock.calls[0][0];
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('reCAPTCHA verification is required');
    });

    it('should attach verification result and call next() on valid token', async () => {
        vi.spyOn(recaptchaService, 'verifyRecaptchaToken').mockResolvedValue({
            success: true,
            challenge_ts: new Date().toISOString()
        });

        const req = {
            body: { recaptchaToken: 'valid-test-token' },
            headers: { 'x-forwarded-for': '127.0.0.1' }
        };
        const res = {};
        const next = vi.fn();

        await verifyRecaptcha(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.recaptcha.success).toBe(true);
    });
});
