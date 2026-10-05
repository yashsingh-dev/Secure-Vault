import { describe, it, expect } from 'vitest';
import secureHash from '../../../src/utils/crypto.utils.js';

describe('Unit: crypto.utils (secureHash)', () => {
    it('should generate a consistent SHA-256 HMAC hex string for same input', () => {
        const input = 'my-sensitive-token';
        const hash1 = secureHash(input);
        const hash2 = secureHash(input);

        expect(typeof hash1).toBe('string');
        expect(hash1).toHaveLength(64); // SHA-256 output is 64 hex chars
        expect(hash1).toBe(hash2);
    });

    it('should generate distinct hashes for different inputs', () => {
        const hashA = secureHash('token-A');
        const hashB = secureHash('token-B');

        expect(hashA).not.toBe(hashB);
    });
});
