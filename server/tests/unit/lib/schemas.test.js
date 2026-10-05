import { describe, it, expect } from 'vitest';
import schemas from '../../../src/lib/schemas.js';

describe('Unit: Zod Validation Schemas (Boundary Validation)', () => {
    describe('emailSchema', () => {
        it('should accept valid email addresses', () => {
            const result = schemas.emailSchema.safeParse('user@example.com');
            expect(result.success).toBe(true);
        });

        it('should reject invalid email formats', () => {
            const result = schemas.emailSchema.safeParse('invalid-email');
            expect(result.success).toBe(false);
            expect(result.error.issues[0].message).toBe('Please enter a valid email address.');
        });
    });

    describe('passwordSchema', () => {
        it('should reject passwords shorter than minimum length (8 chars)', () => {
            const result = schemas.passwordSchema.safeParse('1234567');
            expect(result.success).toBe(false);
            expect(result.error.issues[0].message).toContain('Password must be at least 8 characters');
        });

        it('should accept passwords with 8 or more characters', () => {
            const result = schemas.passwordSchema.safeParse('password123');
            expect(result.success).toBe(true);
        });
    });

    describe('otpCodeSchema', () => {
        it('should validate exact 6-digit length', () => {
            expect(schemas.otpCodeSchema.safeParse('123456').success).toBe(true);
            expect(schemas.otpCodeSchema.safeParse('12345').success).toBe(false);
            expect(schemas.otpCodeSchema.safeParse('1234567').success).toBe(false);
        });
    });

    describe('loginSchema', () => {
        it('should parse valid login body and default rememberMe to false', () => {
            const result = schemas.loginSchema.safeParse({
                email: 'test@example.com',
                password: 'password123'
            });

            expect(result.success).toBe(true);
            expect(result.data.rememberMe).toBe(false);
        });

        it('should reject login if password or email is missing', () => {
            const noEmail = schemas.loginSchema.safeParse({ password: 'password123' });
            expect(noEmail.success).toBe(false);

            const noPass = schemas.loginSchema.safeParse({ email: 'test@example.com' });
            expect(noPass.success).toBe(false);
        });
    });

    describe('updateProfileSchema', () => {
        it('should enforce name length boundaries between 2 and 50 chars', () => {
            expect(schemas.updateProfileSchema.safeParse({ name: 'A' }).success).toBe(false);
            expect(schemas.updateProfileSchema.safeParse({ name: 'A'.repeat(51) }).success).toBe(false);
            expect(schemas.updateProfileSchema.safeParse({ name: 'Valid Name' }).success).toBe(true);
        });

        it('should accept settings updates', () => {
            const result = schemas.updateProfileSchema.safeParse({
                settings: { alwaysRequireOtp: true }
            });
            expect(result.success).toBe(true);
        });
    });
});
