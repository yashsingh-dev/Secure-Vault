import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Integration: V2 Public Demo Endpoints for CDN Testing', () => {
    it('GET /api/v2/users should return 200 with users list and cache-control headers', async () => {
        const res = await request(app).get('/api/v2/users');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Demo users fetched successfully');
        expect(Array.isArray(res.body.payload)).toBe(true);
        expect(res.body.payload.length).toBeGreaterThan(0);
        expect(res.headers['cache-control']).toBe('public, max-age=60, s-maxage=300');
    });

    it('GET /api/v2/todos should return 200 with todos list and cache-control headers', async () => {
        const res = await request(app).get('/api/v2/todos');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Demo todos fetched successfully');
        expect(Array.isArray(res.body.payload)).toBe(true);
        expect(res.body.payload.length).toBeGreaterThan(0);
        expect(res.headers['cache-control']).toBe('public, max-age=60, s-maxage=300');
    });

    it('GET /v2/users (alias) should also work without authentication', async () => {
        const res = await request(app).get('/v2/users');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.payload)).toBe(true);
    });
});
