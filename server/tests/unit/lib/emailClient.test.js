import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import emailClient from '../../../src/lib/emailClient.js';

describe('Unit: emailClient', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.restoreAllMocks();
        process.env.EMAIL_API_KEY = 'test-api-key';
        process.env.SENDER_EMAIL = 'support@securevault.app';
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('should return error when no API key is configured', async () => {
        delete process.env.EMAIL_API_KEY;
        delete process.env.BREVO_API_KEY;

        const result = await emailClient.send({
            to: 'user@example.com',
            subject: 'Test Subject',
            html: '<p>Test</p>'
        });

        expect(result.data).toBeNull();
        expect(result.error).toEqual({ message: 'Email API key is not configured' });
    });

    it('should format payload correctly and return data on successful HTTP response', async () => {
        const mockResponse = { messageId: '<abc123xyz>' };

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            status: 201,
            json: async () => mockResponse
        });

        const result = await emailClient.send({
            to: 'recipient@example.com',
            subject: 'Welcome',
            html: '<h1>Welcome</h1>',
            text: 'Welcome text'
        });

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, options] = fetchSpy.mock.calls[0];

        expect(url).toBe('https://api.brevo.com/v3/smtp/email');
        expect(options.method).toBe('POST');
        expect(options.headers['api-key']).toBe('test-api-key');

        const parsedBody = JSON.parse(options.body);
        expect(parsedBody.to).toEqual([{ email: 'recipient@example.com' }]);
        expect(parsedBody.sender).toEqual({ name: 'Secure Vault', email: 'support@securevault.app' });
        expect(parsedBody.subject).toBe('Welcome');
        expect(parsedBody.htmlContent).toBe('<h1>Welcome</h1>');
        expect(parsedBody.textContent).toBe('Welcome text');

        expect(result.data).toEqual(mockResponse);
        expect(result.error).toBeNull();
    });

    it('should accept array of recipient strings or objects and custom sender', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ messageId: '<msg1>' })
        });

        await emailClient.send({
            to: ['user1@example.com', { email: 'user2@example.com', name: 'User 2' }],
            subject: 'Multi-recipient',
            html: '<p>Hi</p>',
            sender: { name: 'Custom Name', email: 'custom@example.com' }
        });

        const [, options] = fetchSpy.mock.calls[0];
        const parsedBody = JSON.parse(options.body);

        expect(parsedBody.to).toEqual([
            { email: 'user1@example.com' },
            { email: 'user2@example.com', name: 'User 2' }
        ]);
        expect(parsedBody.sender).toEqual({ name: 'Custom Name', email: 'custom@example.com' });
    });

    it('should handle non-ok HTTP responses gracefully', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ code: 'invalid_parameter', message: 'Invalid recipient' })
        });

        const result = await emailClient.send({
            to: 'invalid',
            subject: 'Test',
            html: '<p>Test</p>'
        });

        expect(result.data).toBeNull();
        expect(result.error).toEqual({
            code: 'invalid_parameter',
            message: 'Invalid recipient'
        });
    });

    it('should catch network exceptions gracefully', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

        const result = await emailClient.send({
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>'
        });

        expect(result.data).toBeNull();
        expect(result.error).toEqual({ message: 'Network error' });
    });
});
