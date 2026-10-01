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

export default redis;
