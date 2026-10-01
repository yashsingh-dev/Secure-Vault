import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
    }
});

redis.on('connect', () => {
    console.log('Redis connected successfully.');
});

redis.on('ready', () => {
    console.log('Redis client is ready for commands.');
});

redis.on('error', (err) => {
    console.error('Redis connection error:', err.message);
});

/**
 * Developer-friendly safe Redis wrapper.
 * Automatically catches connection/command errors, logs meaningful diagnostics,
 * and returns safe default fallbacks so application code stays clean and try/catch free.
 */
export const safeRedis = {
    /**
     * Safely get a value by key.
     * @param {string} key 
     * @param {*} fallback Value returned if key is missing or Redis errors (default null)
     */
    async get(key, fallback = null) {
        try {
            const value = await redis.get(key);
            return value !== null ? value : fallback;
        } catch (err) {
            console.error(`[safeRedis.get Error] key="${key}":`, err.message);
            return fallback;
        }
    },

    /**
     * Safely set a value by key with optional TTL in seconds.
     * @param {string} key 
     * @param {string|number} value 
     * @param {number|null} exSeconds 
     */
    async set(key, value, exSeconds = null) {
        try {
            if (exSeconds && Number.isInteger(Number(exSeconds)) && Number(exSeconds) > 0) {
                await redis.set(key, value.toString(), 'EX', Number(exSeconds));
            } else {
                await redis.set(key, value.toString());
            }
            return true;
        } catch (err) {
            console.error(`[safeRedis.set Error] key="${key}":`, err.message);
            return false;
        }
    },

    /**
     * Safely check if a key exists in Redis.
     * @param {string} key 
     * @param {boolean} fallback Fallback if Redis fails (default false)
     * @returns {Promise<boolean>}
     */
    async exists(key, fallback = false) {
        try {
            const count = await redis.exists(key);
            return count > 0;
        } catch (err) {
            console.error(`[safeRedis.exists Error] key="${key}":`, err.message);
            return fallback;
        }
    },

    /**
     * Safely delete one or multiple keys.
     * Accepts key strings, arrays of keys, or spread arguments.
     * @param  {...(string|string[])} keys 
     * @returns {Promise<number>}
     */
    async del(...keys) {
        try {
            const flattened = keys.flat(Infinity).filter(k => typeof k === 'string' && k.trim() !== '');
            if (flattened.length === 0) return 0;
            return await redis.del(...flattened);
        } catch (err) {
            console.error(`[safeRedis.del Error] keys="${keys.join(', ')}":`, err.message);
            return 0;
        }
    }
};

export default redis;
