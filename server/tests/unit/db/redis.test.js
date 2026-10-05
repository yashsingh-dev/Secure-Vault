import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeRedis } from '../../../src/db/redis.js';
import redis from '../../../src/db/redis.js';

describe('Unit: safeRedis Wrapper', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should safely serialize and retrieve JSON with setJson and getJson', async () => {
        const payload = { userId: '123', roles: ['admin'] };
        vi.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(payload));
        vi.spyOn(redis, 'set').mockResolvedValue('OK');

        const setResult = await safeRedis.setJson('test:json', payload, 60);
        expect(setResult).toBe(true);

        const getResult = await safeRedis.getJson('test:json');
        expect(getResult).toEqual(payload);
    });

    it('should return fallback if Redis throws an exception in get', async () => {
        vi.spyOn(redis, 'get').mockRejectedValue(new Error('Redis connection lost'));

        const value = await safeRedis.get('failing:key', 'default_fallback');
        expect(value).toBe('default_fallback');
    });

    it('should delete keys safely even when empty or array passed', async () => {
        vi.spyOn(redis, 'del').mockResolvedValue(2);

        const count = await safeRedis.del(['key1', 'key2']);
        expect(count).toBe(2);

        const emptyCount = await safeRedis.del([]);
        expect(emptyCount).toBe(0);
    });
});
