import { describe, it, expect, vi } from 'vitest';
import { formatTimeRemaining, msToSuffix, msToHumanDuration } from '../../../src/lib/time.js';

describe('Unit: time Lib', () => {
    describe('msToSuffix', () => {
        it('should format milliseconds to short readable units', () => {
            expect(msToSuffix(60 * 1000)).toBe('1m');
            expect(msToSuffix(5 * 60 * 1000)).toBe('5m');
            expect(msToSuffix(60 * 60 * 1000)).toBe('1h');
            expect(msToSuffix(24 * 60 * 60 * 1000)).toBe('1d');
            expect(msToSuffix(30 * 1000)).toBe('30s');
            expect(msToSuffix(0)).toBe('0s');
        });
    });

    describe('msToHumanDuration', () => {
        it('should format milliseconds to natural language phrase', () => {
            expect(msToHumanDuration(60 * 1000)).toBe('1 minute');
            expect(msToHumanDuration(5 * 60 * 1000)).toBe('5 minutes');
            expect(msToHumanDuration(60 * 60 * 1000)).toBe('1 hour');
            expect(msToHumanDuration(2 * 60 * 60 * 1000)).toBe('2 hours');
            expect(msToHumanDuration(45 * 1000)).toBe('45 seconds');
        });
    });

    describe('formatTimeRemaining', () => {
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
});
