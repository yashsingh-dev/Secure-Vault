import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendOTPEmail } from '../../../src/utils/sendMail.utils.js';
import emailClient from '../../../src/lib/emailClient.js';
import { CONSTANTS } from '../../../src/config/constants.js';

describe('Unit: sendMail.utils', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should return success in testing mode without dispatching live email', async () => {
        const originalTesting = CONSTANTS.OTP.TESTING;
        CONSTANTS.OTP.TESTING = true;

        const res = await sendOTPEmail('test@example.com', '123456');

        expect(res.success).toBe(true);
        expect(res.data.otp).toBe('123456');

        CONSTANTS.OTP.TESTING = originalTesting;
    });

    it('should call emailClient.send if CONSTANTS.OTP.TESTING is false', async () => {
        const originalTesting = CONSTANTS.OTP.TESTING;
        CONSTANTS.OTP.TESTING = false;

        const sendSpy = vi.spyOn(emailClient, 'send').mockResolvedValue({
            data: { messageId: 'email-id-123' },
            error: null
        });

        const res = await sendOTPEmail('test@example.com', '654321');

        expect(sendSpy).toHaveBeenCalled();
        expect(res.success).toBe(true);
        expect(res.data.messageId).toBe('email-id-123');

        CONSTANTS.OTP.TESTING = originalTesting;
    });

    it('should handle email delivery rejection gracefully', async () => {
        const originalTesting = CONSTANTS.OTP.TESTING;
        CONSTANTS.OTP.TESTING = false;

        vi.spyOn(emailClient, 'send').mockResolvedValue({
            data: null,
            error: { message: 'Invalid API key' }
        });

        const res = await sendOTPEmail('test@example.com', '654321');

        expect(res.success).toBe(false);
        expect(res.error).toBeDefined();

        CONSTANTS.OTP.TESTING = originalTesting;
    });
});
