import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Integration: V2 Public Demo Endpoints for CDN Testing', () => {
    it('GET /api/v2/users should return 200 with 7 random users and cache-control headers', async () => {
        const res = await request(app).get('/api/v2/users');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Demo users fetched successfully');
        expect(Array.isArray(res.body.payload)).toBe(true);
        expect(res.body.payload.length).toBe(7);
        expect(res.headers['cache-control']).toBe('public, max-age=60, s-maxage=300');

        // Verify structure of first user
        const firstUser = res.body.payload[0];
        expect(firstUser).toHaveProperty('id');
        expect(firstUser).toHaveProperty('name');
        expect(firstUser).toHaveProperty('email');
        expect(firstUser).toHaveProperty('address');
        expect(firstUser).toHaveProperty('company');
    });

    it('GET /api/v2/todos should return 200 with 7 random todos and cache-control headers', async () => {
        const res = await request(app).get('/api/v2/todos');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Demo todos fetched successfully');
        expect(Array.isArray(res.body.payload)).toBe(true);
        expect(res.body.payload.length).toBe(7);
        expect(res.headers['cache-control']).toBe('public, max-age=60, s-maxage=300');

        // Verify structure of first todo
        const firstTodo = res.body.payload[0];
        expect(firstTodo).toHaveProperty('userId');
        expect(firstTodo).toHaveProperty('id');
        expect(firstTodo).toHaveProperty('title');
        expect(firstTodo).toHaveProperty('completed');
    });

    it('Subsequent requests should return randomized subsets', async () => {
        const res1 = await request(app).get('/api/v2/users');
        const res2 = await request(app).get('/api/v2/users');

        expect(res1.body.payload.length).toBe(7);
        expect(res2.body.payload.length).toBe(7);

        const ids1 = res1.body.payload.map(u => u.id).join(',');
        const ids2 = res2.body.payload.map(u => u.id).join(',');
        
        // Given 40 items choosing 7 randomly, probability of identical sequence is astronomically low
        expect(ids1).not.toBe(ids2);
    });

    it('GET /v2/users (alias) should also work without authentication', async () => {
        const res = await request(app).get('/v2/users');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.payload.length).toBe(7);
    });
});
