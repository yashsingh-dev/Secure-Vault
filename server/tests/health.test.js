import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Server Health and Basic Routes', () => {
  it('GET /api/health should return status 200 with message', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.text).toBe('API is running...');
  });

  it('GET /api/csrf-token should return a CSRF token', async () => {
    const res = await request(app).get('/api/csrf-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('csrfToken');
    expect(typeof res.body.csrfToken).toBe('string');
  });
});
