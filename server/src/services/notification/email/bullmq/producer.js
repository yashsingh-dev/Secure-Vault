import { Queue } from 'bullmq';
import { CONSTANTS } from '../../../../config/constants.js';
import { logger } from '../../../../lib/logger.js';
import { EMAIL_PRIORITIES, EMAIL_JOB_TYPES, DEFAULT_JOB_PRIORITIES } from '../index.js';

export const QUEUE_NAME = 'email';

export const bullmqConnection = {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    maxRetriesPerRequest: null
};

// Singleton instance of the BullMQ email queue
export const emailQueue = new Queue(QUEUE_NAME, {
    connection: bullmqConnection,
    defaultJobOptions: {
        attempts: CONSTANTS.QUEUE?.MAX_ATTEMPTS || 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        removeOnComplete: 100, // Keep last 100 completed jobs for debugging
        removeOnFail: false    // Retain failed jobs in failed set for inspection (DLQ equivalent)
    }
});

/**
 * BullMQ Email Queue Producer.
 * Enqueues email jobs into Redis using BullMQ's native priority scheduling and retry engines.
 */
export const bullmqProducer = {
    /**
     * Enqueue an email job into BullMQ.
     * 
     * @param {Object} params
     * @param {string} params.type - Job type from EMAIL_JOB_TYPES
     * @param {string} params.to - Recipient email address
     * @param {Object} [params.payload={}] - Payload data (e.g. { otp: 123456 })
     * @param {string} [params.priority] - 'high' or 'low' (optional, falls back to mapping)
     * @param {number} [params.ttlSeconds=900] - TTL in seconds (e.g., 15 min for OTPs)
     * @returns {Promise<{ success: boolean, jobId?: string, priority?: string, error?: string }>}
     */
    async addJob({ type, to, payload = {}, priority, ttlSeconds = 900 }) {
        try {
            if (!to || typeof to !== 'string') {
                throw new Error('Recipient email address is required.');
            }

            const targetPriority = priority || DEFAULT_JOB_PRIORITIES?.[type] || EMAIL_PRIORITIES.HIGH;
            const normalizedPriority = targetPriority === EMAIL_PRIORITIES.LOW ? EMAIL_PRIORITIES.LOW : EMAIL_PRIORITIES.HIGH;

            // In BullMQ, lower numerical value = higher priority:
            // High priority = 1, Low priority = 2
            const bullPriority = normalizedPriority === EMAIL_PRIORITIES.HIGH ? 1 : 2;

            const job = await emailQueue.add(
                type,
                {
                    type,
                    to: to.trim().toLowerCase(),
                    payload,
                    priority: normalizedPriority,
                    ttlSeconds,
                    expiresAt: Date.now() + (ttlSeconds * 1000)
                },
                {
                    priority: bullPriority
                }
            );

            logger.info(
                { jobId: job.id, type, recipient: to, priority: normalizedPriority, queue: QUEUE_NAME },
                'Email notification job pushed to BullMQ queue'
            );

            return {
                success: true,
                jobId: job.id,
                priority: normalizedPriority,
                queue: QUEUE_NAME
            };
        } catch (err) {
            logger.error(
                { err: err.message, type, recipient: to },
                'Failed to push email job into BullMQ queue'
            );
            return {
                success: false,
                error: err.message
            };
        }
    },

    /**
     * Helper to get queue lengths & job counts from BullMQ.
     */
    async getQueueLengths() {
        try {
            const counts = await emailQueue.getJobCounts('waiting', 'active', 'failed', 'delayed', 'prioritized');

            return {
                waiting: counts.waiting || 0,
                active: counts.active || 0,
                failed: counts.failed || 0,
                delayed: counts.delayed || 0,
                prioritized: counts.prioritized || 0,
                processing: counts.active || 0,
                dlq: counts.failed || 0,
                totalPending: (counts.waiting || 0) + (counts.delayed || 0) + (counts.prioritized || 0)
            };
        } catch (err) {
            logger.error({ err: err.message }, 'Failed to fetch BullMQ job counts from Redis');
            return {
                waiting: 0,
                active: 0,
                failed: 0,
                delayed: 0,
                prioritized: 0,
                processing: 0,
                dlq: 0,
                totalPending: 0
            };
        }
    },

    /**
     * Gracefully close the queue connection.
     */
    async close() {
        await emailQueue.close();
    }
};

export default bullmqProducer;
