import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Integration: Health and CSRF Endpoints', () => {
    it('GET /api/health should return 200 with status message', async () => {
        const res = await request(app).get('/api/health');

        expect(res.status).toBe(200);
        expect(res.text).toBe('API is running...');
    });

    it('GET /api/csrf-token should generate CSRF token and set cookie', async () => {
        const res = await request(app).get('/api/csrf-token');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('csrfToken');
        expect(typeof res.body.csrfToken).toBe('string');
        expect(res.headers['set-cookie']).toBeDefined();
    });
});
