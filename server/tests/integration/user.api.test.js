import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import jwt from 'jsonwebtoken';
import { safeRedis } from '../../src/db/redis.js';
import userService from '../../src/services/v1/user.service.js';

describe('Integration: User API Endpoints', () => {
    const mockUserId = '64f1a2b3c4d5e6f7a8b9c0d1';
    const secret = process.env.JWT_ACCESS_KEY || 'default-key';
    let validToken;
    let csrfToken;
    let csrfCookie;

    beforeEach(async () => {
        vi.restoreAllMocks();

        validToken = jwt.sign({ _id: mockUserId, tokenVersion: 1 }, secret);

        const csrfRes = await request(app).get('/api/csrf-token');
        csrfToken = csrfRes.body.csrfToken;
        csrfCookie = csrfRes.headers['set-cookie'];

        vi.spyOn(safeRedis, 'exists').mockResolvedValue(false);
        vi.spyOn(safeRedis, 'getJson').mockResolvedValue({ tokenVersion: 1 });
    });

    describe('GET /api/v1/user/profile', () => {
        it('should reject unauthenticated requests with 401', async () => {
            const res = await request(app).get('/api/v1/user/profile');
            expect(res.status).toBe(401);
        });

        it('should return user profile when authenticated', async () => {
            vi.spyOn(userService, 'getProfile').mockResolvedValue({
                id: mockUserId,
                name: 'Alice',
                email: 'alice@example.com',
                isVerified: true
            });

            const res = await request(app)
                .get('/api/v1/user/profile')
                .set('Cookie', [`__Host-sv_at=${validToken}`]);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.payload.name).toBe('Alice');
        });
    });

    describe('PUT /api/v1/user/profile', () => {
        it('should update user profile when CSRF and auth are provided', async () => {
            vi.spyOn(userService, 'updateProfile').mockResolvedValue({
                id: mockUserId,
                name: 'Alice Updated',
                email: 'alice@example.com'
            });

            const res = await request(app)
                .put('/api/v1/user/profile')
                .set('Cookie', [...(Array.isArray(csrfCookie) ? csrfCookie : [csrfCookie]), `__Host-sv_at=${validToken}`])
                .set('x-csrf-token', csrfToken)
                .send({
                    name: 'Alice Updated'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.payload.name).toBe('Alice Updated');
        });
    });
});
