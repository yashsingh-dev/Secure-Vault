import { describe, it, expect, vi } from 'vitest';
import { formatTimeRemaining } from '../../../src/lib/time.js';

describe('Unit: formatTimeRemaining Lib', () => {
    it('should return "a moment" if timestamp is in the past or zero', () => {
        const past = Date.now() - 5000;
        expect(formatTimeRemaining(past)).toBe('a moment');
    });

    it('should format seconds properly when under a minute', () => {
        const now = 1000000;
        vi.spyOn(Date, 'now').mockReturnValue(now);

        const expiry = now + 45 * 1000; // 45 seconds
        expect(formatTimeRemaining(expiry)).toBe('45 seconds');

        const singleSecond = now + 1 * 1000; // 1 second
        expect(formatTimeRemaining(singleSecond)).toBe('1 second');
    });

    it('should format minutes and seconds properly', () => {
        const now = 1000000;
        vi.spyOn(Date, 'now').mockReturnValue(now);

        const expiry = now + (2 * 60 * 1000) + (15 * 1000); // 2 minutes and 15 seconds
        expect(formatTimeRemaining(expiry)).toBe('2 minutes and 15 seconds');

        const singleMinute = now + (1 * 60 * 1000); // 1 minute
        expect(formatTimeRemaining(singleMinute)).toBe('1 minute');
    });
});
