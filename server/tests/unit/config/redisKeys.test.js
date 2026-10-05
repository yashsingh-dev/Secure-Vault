import { describe, it, expect } from 'vitest';
import REDIS_KEYS from '../../../src/config/redisKeys.js';

describe('Unit: REDIS_KEYS Config', () => {
    it('should generate correct blacklist key', () => {
        const hash = 'sample-hash-123';
        expect(REDIS_KEYS.blacklist(hash)).toBe('blacklist:sample-hash-123');
    });

    it('should generate correct session key', () => {
        const sessionId = 'session-uuid-456';
        expect(REDIS_KEYS.session(sessionId)).toBe('session:session-uuid-456');
    });

    it('should generate correct userBlock key', () => {
        const userId = 'user-id-789';
        expect(REDIS_KEYS.userBlock(userId)).toBe('user:block:user-id-789');
    });

    it('should generate correct userOtp key', () => {
        const userId = 'user-id-789';
        expect(REDIS_KEYS.userOtp(userId)).toBe('user:otp:user-id-789');
    });

    it('should generate correct userProfile key', () => {
        const userId = 'user-id-789';
        expect(REDIS_KEYS.userProfile(userId)).toBe('user:profile:user-id-789');
    });

    it('should generate correct userResetToken key', () => {
        const userId = 'user-id-789';
        expect(REDIS_KEYS.userResetToken(userId)).toBe('user:reset:token:user-id-789');
    });

    it('should normalize email to lowercase and trim in emailToId lookup', () => {
        const email = '  USER@Example.COM ';
        expect(REDIS_KEYS.emailToId(email)).toBe('email:to:id:user@example.com');
    });
});
