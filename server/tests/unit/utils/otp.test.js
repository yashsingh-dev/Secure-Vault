import { describe, it, expect } from 'vitest';
import generateOTP from '../../../src/utils/otp.utils.js';
import { CONSTANTS } from '../../../src/config/constants.js';

describe('Unit: otp.utils (generateOTP)', () => {
    it('should generate an OTP matching the defined length in constants', () => {
        const otp = generateOTP();

        expect(typeof otp).toBe('number');
        const otpStr = otp.toString();
        expect(otpStr.length).toBe(CONSTANTS.OTP.LENGTH);
    });

    it('should return deterministic test OTP when CONSTANTS.OTP.TESTING is true', () => {
        if (CONSTANTS.OTP.TESTING) {
            const otp = generateOTP();
            expect(otp).toBe(123456);
        }
    });
});
