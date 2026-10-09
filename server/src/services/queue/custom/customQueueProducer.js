import crypto from 'crypto';
import redis from '../../../db/redis.js';
import REDIS_KEYS from '../../../config/redisKeys.js';
import { logger } from '../../../lib/logger.js';

const MAX_ATTEMPTS = 3;

/**
 * Valid priority levels for email jobs.
 */
export const EMAIL_PRIORITIES = {
    HIGH: 'high',   // OTPs, Password Resets, MFA (Processed first)
    LOW: 'low'      // Login alerts, Welcome emails, digest (Processed second)
};

/**
 * Valid notification types.
 */
export const EMAIL_JOB_TYPES = {
    OTP: 'OTP_VERIFICATION',
    PASSWORD_RESET: 'PASSWORD_RESET',
    LOGIN_ALERT: 'LOGIN_ALERT',
    WELCOME: 'WELCOME'
};

/**
 * Custom Redis Queue Producer.
 * Pushes email jobs into designated priority lists in Redis.
 */
export const customQueueProducer = {
    /**
     * Enqueue an email job into Redis.
     * 
     * @param {Object} params
     * @param {string} params.type - Job type from EMAIL_JOB_TYPES
     * @param {string} params.to - Recipient email address
     * @param {Object} params.payload - Payload data (e.g., { otp: 123456, name: 'Alice' })
     * @param {string} [params.priority='high'] - 'high' or 'low'
     * @param {number} [params.ttlSeconds=300] - Job Time-To-Live in seconds (e.g., 5 min for OTPs)
     * @returns {Promise<{ success: boolean, jobId: string, priority: string }>}
     */
    async addJob({ type, to, payload = {}, priority = EMAIL_PRIORITIES.HIGH, ttlSeconds = 300 }) {
        try {
            if (!to || typeof to !== 'string') {
                throw new Error('Recipient email address is required.');
            }

            const jobId = crypto.randomUUID();
            const normalizedPriority = priority === EMAIL_PRIORITIES.LOW ? EMAIL_PRIORITIES.LOW : EMAIL_PRIORITIES.HIGH;

            const job = {
                id: jobId,
                type,
                to: to.trim().toLowerCase(),
                payload,
                priority: normalizedPriority,
                attempts: 0,
                maxAttempts: MAX_ATTEMPTS,
                createdAt: Date.now(),
                expiresAt: Date.now() + (ttlSeconds * 1000)
            };

            const serializedJob = JSON.stringify(job);
            const queueKey = normalizedPriority === EMAIL_PRIORITIES.HIGH
                ? REDIS_KEYS.queue.high()
                : REDIS_KEYS.queue.low();

            // LPUSH adds the job to the head of the Redis list
            await redis.lpush(queueKey, serializedJob);

            logger.info(
                { jobId, type, recipient: job.to, priority: normalizedPriority, queue: queueKey },
                'Email notification job pushed to Redis queue'
            );

            return {
                success: true,
                jobId,
                priority: normalizedPriority,
                queue: queueKey
            };
        } catch (err) {
            logger.error(
                { err: err.message, type, recipient: to },
                'Failed to push email job into Redis queue'
            );
            return {
                success: false,
                error: err.message
            };
        }
    },

    /**
     * Helper to get the current depth (number of waiting jobs) of the queues.
     */
    async getQueueLengths() {
        try {
            const [highCount, lowCount, processingCount, dlqCount] = await Promise.all([
                redis.llen(REDIS_KEYS.queue.high()),
                redis.llen(REDIS_KEYS.queue.low()),
                redis.llen(REDIS_KEYS.queue.processing()),
                redis.llen(REDIS_KEYS.queue.dlq())
            ]);

            return {
                high: highCount,
                low: lowCount,
                processing: processingCount,
                dlq: dlqCount,
                totalPending: highCount + lowCount
            };
        } catch (err) {
            logger.error({ err: err.message }, 'Failed to fetch queue lengths from Redis');
            return { high: 0, low: 0, processing: 0, dlq: 0, totalPending: 0 };
        }
    }
};

export default customQueueProducer;
