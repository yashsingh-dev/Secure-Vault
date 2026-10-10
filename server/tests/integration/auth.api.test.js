import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import * as recaptchaService from '../../src/services/recaptcha.service.js';
import authService from '../../src/services/v1/auth.service.js';

describe('Integration: Auth API Endpoints', () => {
    let csrfToken;
    let csrfCookie;

    beforeEach(async () => {
        vi.restoreAllMocks();

        // 1. Fetch CSRF token and cookie for state-changing POST requests
        const csrfRes = await request(app).get('/api/csrf-token');
        csrfToken = csrfRes.body.csrfToken;
        csrfCookie = csrfRes.headers['set-cookie'];
    });

    describe('POST /api/v1/auth/login', () => {
        it('should block request if CSRF token is missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'user@example.com',
                    password: 'password123',
                    recaptchaToken: 'dummy'
                });

            expect(res.status).toBe(403);
            expect(res.body.message).toContain('CSRF');
        });

        it('should reject login if reCAPTCHA verification fails', async () => {
            vi.spyOn(recaptchaService, 'verifyRecaptchaToken').mockRejectedValue(
                new Error('reCAPTCHA verification failed. Please try again.')
            );

            const res = await request(app)
                .post('/api/v1/auth/login')
                .set('Cookie', csrfCookie)
                .set('x-csrf-token', csrfToken)
                .send({
                    email: 'user@example.com',
                    password: 'password123',
                    recaptchaToken: 'bad-token'
                });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('should successfully login and set cookies when credentials and reCAPTCHA are valid', async () => {
            // Mock reCAPTCHA verification
            vi.spyOn(recaptchaService, 'verifyRecaptchaToken').mockResolvedValue({ success: true });

            // Mock authService.login
            vi.spyOn(authService, 'login').mockResolvedValue({
                user: {
                    _id: '64f1a2b3c4d5e6f7a8b9c0d1',
                    email: 'user@example.com',
                    tokenVersion: 1
                },
                is2FAEnabled: false
            });

            const res = await request(app)
                .post('/api/v1/auth/login')
                .set('Cookie', csrfCookie)
                .set('x-csrf-token', csrfToken)
                .send({
                    email: 'user@example.com',
                    password: 'password123',
                    recaptchaToken: 'valid-token'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.payload.email).toBe('user@example.com');
            expect(res.headers['set-cookie']).toBeDefined();
        });
    });

    describe('POST /api/v1/auth/register', () => {
        it('should reject registration if payload fails Zod validation', async () => {
            vi.spyOn(recaptchaService, 'verifyRecaptchaToken').mockResolvedValue({ success: true });

            const res = await request(app)
                .post('/api/v1/auth/register')
                .set('Cookie', csrfCookie)
                .set('x-csrf-token', csrfToken)
                .send({
                    name: 'Test',
                    email: 'invalid-email',
                    password: 'short'
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
});
