import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as recaptchaService from '../../../src/services/v1/recaptcha.service.js';

describe('Unit: recaptcha.service', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should throw 400 if token is missing or empty', async () => {
        await expect(recaptchaService.verifyRecaptchaToken(''))
            .rejects.toThrow('reCAPTCHA verification is required');
    });

    it('should throw 500 if RECAPTCHA_SECRET_KEY is missing from environment', async () => {
        const originalKey = process.env.RECAPTCHA_SECRET_KEY;
        delete process.env.RECAPTCHA_SECRET_KEY;

        await expect(recaptchaService.verifyRecaptchaToken('dummy-token'))
            .rejects.toThrow('reCAPTCHA service is not configured on the server.');

        process.env.RECAPTCHA_SECRET_KEY = originalKey;
    });

    it('should verify token with Google API successfully', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                challenge_ts: new Date().toISOString(),
                hostname: 'localhost'
            })
        });

        const result = await recaptchaService.verifyRecaptchaToken('valid-token');
        expect(result.success).toBe(true);
    });

    it('should throw mapped ApiError if Google returns an error code', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                success: false,
                'error-codes': ['timeout-or-duplicate']
            })
        });

        await expect(recaptchaService.verifyRecaptchaToken('expired-token'))
            .rejects.toThrow('reCAPTCHA verification has expired');
    });
});
