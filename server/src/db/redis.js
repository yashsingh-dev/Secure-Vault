import Redis from 'ioredis';
import REDIS_KEYS from '../config/redisKeys.js';
import { CONSTANTS } from '../config/constants.js';
import { logger } from '../lib/logger.js';

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
    logger.info('Redis connection initiated');
});

redis.on('ready', () => {
    logger.info('Redis client initialized and ready for commands');
});

redis.on('error', (err) => {
    logger.error({ err: err.message }, 'Redis connection error encountered');
});

/**
 * Developer-friendly safe Redis wrapper.
 * Automatically catches connection/command errors, logs meaningful diagnostics,
 * and returns safe default fallbacks so application code stays clean and try/catch free.
 */
export const safeRedis = {
    /**
     * Safely get a raw string value by key.
     * @param {string} key 
     * @param {*} fallback Value returned if key is missing or Redis errors (default null)
     */
    async get(key, fallback = null) {
        try {
            const value = await redis.get(key);
            return value !== null ? value : fallback;
        } catch (err) {
            logger.error({ key, err: err.message }, 'Failed to fetch key from Redis cache');
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
            logger.error({ key, err: err.message }, 'Failed to set key in Redis cache');
            return false;
        }
    },

    /**
     * Safely get and parse a JSON object from Redis.
     * Useful for Bucket 1 (Block), Bucket 2 (OTP), and Bucket 3 (Profile).
     * @param {string} key 
     * @param {*} fallback 
     */
    async getJson(key, fallback = null) {
        try {
            const raw = await redis.get(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (err) {
            logger.error({ key, err: err.message }, 'Failed to parse JSON payload from Redis cache');
            return fallback;
        }
    },

    /**
     * Safely serialize and store a JSON object into Redis with optional TTL.
     * @param {string} key 
     * @param {object} objectData 
     * @param {number|null} exSeconds 
     */
    async setJson(key, objectData, exSeconds = null) {
        try {
            const jsonString = JSON.stringify(objectData);
            if (exSeconds && Number.isInteger(Number(exSeconds)) && Number(exSeconds) > 0) {
                await redis.set(key, jsonString, 'EX', Number(exSeconds));
            } else {
                await redis.set(key, jsonString);
            }
            return true;
        } catch (err) {
            logger.error({ key, err: err.message }, 'Failed to serialize and store JSON payload in Redis cache');
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
            logger.error({ key, err: err.message }, 'Failed to check key existence in Redis cache');
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
            logger.error({ keys, err: err.message }, 'Failed to delete key(s) from Redis cache');
            return 0;
        }
    },

    /**
     * Safely updates specific fields in the cached user profile.
     * @param {string} userId 
     * @param {object} updates 
     * @returns {Promise<boolean>}
     */
    async updateUserProfile(userId, updates) {
        try {
            const key = `${REDIS_KEYS.PREFIX.USER_PROFILE}:${userId}`;
            const profile = await this.getJson(key);
            if (profile) {
                Object.assign(profile, updates);
                return await this.setJson(key, profile, Math.floor(CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000));
            }
            return false;
        } catch (err) {
            logger.error({ userId, err: err.message }, 'Failed to update cached user profile in Redis');
            return false;
        }
    }
};

export default redis;
