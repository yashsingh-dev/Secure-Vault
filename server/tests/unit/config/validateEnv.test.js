import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateEnv } from '../../../src/config/validateEnv.js';

describe('Unit: validateEnv Config', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.restoreAllMocks();
    });

    it('should pass validation when all required keys are present', () => {
        // Ensure required keys are populated
        process.env.MONGO_URI = 'mongodb://localhost:27017/test';
        process.env.RESEND_API_KEY = 're_test_key';
        process.env.RESEND_FROM_EMAIL = 'test@example.com';
        process.env.OAUTH_GOOGLE_CLIENT_ID = 'google-client-id';
        process.env.OAUTH_GOOGLE_SECRET = 'google-secret';
        process.env.RECAPTCHA_SECRET_KEY = 'recaptcha-key';

        expect(() => validateEnv()).not.toThrow();
    });

    it('should assign safe defaults for missing optional keys', () => {
        process.env.MONGO_URI = 'mongodb://localhost:27017/test';
        process.env.RESEND_API_KEY = 're_test_key';
        process.env.RESEND_FROM_EMAIL = 'test@example.com';
        process.env.OAUTH_GOOGLE_CLIENT_ID = 'google-client-id';
        process.env.OAUTH_GOOGLE_SECRET = 'google-secret';
        process.env.RECAPTCHA_SECRET_KEY = 'recaptcha-key';

        delete process.env.PORT;
        delete process.env.CLIENT_URL_DEV;

        validateEnv();

        expect(process.env.PORT).toBe('3000');
        expect(process.env.CLIENT_URL_DEV).toBe('http://localhost:5173');
    });

    it('should terminate process if required keys are missing', () => {
        delete process.env.MONGO_URI;

        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit called with ${code}`);
        });

        expect(() => validateEnv()).toThrow('process.exit called with 1');
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
