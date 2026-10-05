import { describe, it, expect } from 'vitest';
import { createHash, verifyHash } from '../../../src/utils/bcrypt.utils.js';

describe('Unit: bcrypt.utils', () => {
    it('should hash a password and verify it successfully', async () => {
        const rawPassword = 'super-secret-password-123';
        const hash = await createHash(rawPassword);

        expect(hash).toBeDefined();
        expect(hash).not.toBe(rawPassword);
        expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix

        const isMatch = await verifyHash(rawPassword, hash);
        expect(isMatch).toBe(true);
    });

    it('should reject verification if password does not match', async () => {
        const rawPassword = 'correct-password';
        const hash = await createHash(rawPassword);

        const isMatch = await verifyHash('wrong-password', hash);
        expect(isMatch).toBe(false);
    });
});
