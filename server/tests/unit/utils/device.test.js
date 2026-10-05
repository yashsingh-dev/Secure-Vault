import { describe, it, expect } from 'vitest';
import { parseClientMeta, parseUserAgent } from '../../../src/utils/device.utils.js';

describe('Unit: device.utils', () => {
    describe('parseUserAgent', () => {
        it('should detect macOS and Chrome correctly', () => {
            const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            const parsed = parseUserAgent(ua);

            expect(parsed.os).toBe('macOS');
            expect(parsed.browser).toBe('Chrome 120');
            expect(parsed.device).toBe('Desktop');
        });

        it('should detect Windows and Edge correctly', () => {
            const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
            const parsed = parseUserAgent(ua);

            expect(parsed.os).toBe('Windows 10/11');
            expect(parsed.browser).toBe('Edge 120');
            expect(parsed.device).toBe('Desktop');
        });

        it('should detect iPhone mobile device correctly', () => {
            const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
            const parsed = parseUserAgent(ua);

            expect(parsed.os).toBe('iOS (iPhone)');
            expect(parsed.device).toBe('Mobile');
            expect(parsed.browser).toBe('Safari 17');
        });

        it('should return safe defaults when userAgent is empty', () => {
            const parsed = parseUserAgent('');
            expect(parsed.os).toBe('Unknown OS');
            expect(parsed.browser).toBe('Unknown Browser');
            expect(parsed.device).toBe('Desktop');
        });
    });

    describe('parseClientMeta', () => {
        it('should extract client IP and handle localhost normalization', () => {
            const mockReq = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                    'x-forwarded-for': '127.0.0.1, 10.0.0.1'
                }
            };

            const meta = parseClientMeta(mockReq);
            expect(meta.ip).toBe('127.0.0.1 (Localhost)');
            expect(meta.os).toBe('macOS');
        });
    });
});
