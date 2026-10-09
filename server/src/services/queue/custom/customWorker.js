import redis from '../../../db/redis.js';
import REDIS_KEYS from '../../../config/redisKeys.js';
import { CONSTANTS } from '../../../config/constants.js';
import { logger } from '../../../lib/logger.js';
import dispatchEmailJob from './jobDispatcher.js';

class CustomQueueWorker {
    constructor() {
        this.timer = null;
        this.isRunning = false;
        this.isProcessingBatch = false;
        this.intervalMs = 1000; // 1 second tick
    }

    /**
     * Start the interval-based queue worker.
     */
    start() {
        if (this.isRunning) {
            logger.warn('CustomQueueWorker is already running.');
            return;
        }

        this.isRunning = true;
        logger.info(
            { intervalMs: this.intervalMs, rateLimitPerSec: CONSTANTS.QUEUE?.EMAIL_RATE_LIMIT_PER_SEC || 10 },
            'Starting CustomQueueWorker interval loop'
        );

        // Run recovery check for any stranded items in processing list on startup
        this.recoverStrandedJobs().catch((err) => {
            logger.warn({ err: err.message }, 'Failed initial stranded jobs recovery sweep');
        });

        this.timer = setInterval(() => {
            this.tick().catch((err) => {
                logger.error({ err: err.message }, 'Error in CustomQueueWorker tick');
            });
        }, this.intervalMs);

        // Allow node process to shut down cleanly if needed
        if (this.timer.unref) {
            this.timer.unref();
        }
    }

    /**
     * Stop the worker loop cleanly.
     */
    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        logger.info('CustomQueueWorker stopped.');
    }

    /**
     * Recovery on worker start:
     * If server previously crashed mid-send, return stranded jobs from
     * processing list back into high priority queue.
     */
    async recoverStrandedJobs() {
        const procKey = REDIS_KEYS.queue.processing();
        const highKey = REDIS_KEYS.queue.high();
        let recovered = 0;

        while (true) {
            const rawJob = await redis.rpoplpush(procKey, highKey);
            if (!rawJob) break;
            recovered++;
        }

        if (recovered > 0) {
            logger.info({ recoveredCount: recovered }, 'Recovered stranded in-flight jobs back to high queue');
        }
    }

    /**
     * The 1-second Tick Execution:
     * 1. Rate-limit check (Tokens left in this second).
     * 2. Weighted quota calculation (8 High : 2 Low).
     * 3. Atomic pop to processing list.
     * 4. Parallel dispatch (Promise.allSettled).
     * 5. Acknowledgment or retry handling.
     */
    async tick() {
        // Prevent overlapping batch execution if an async cycle exceeds 1000ms
        if (this.isProcessingBatch || !this.isRunning) return;
        this.isProcessingBatch = true;

        try {
            const rateLimitMax = CONSTANTS.QUEUE?.EMAIL_RATE_LIMIT_PER_SEC || 10;
            const highWeight = CONSTANTS.QUEUE?.HIGH_PRIORITY_WEIGHT || 8;
            const lowWeight = CONSTANTS.QUEUE?.LOW_PRIORITY_WEIGHT || 2;

            // 1. Check current second rate limit quota in Redis
            const currentSecond = Math.floor(Date.now() / 1000);
            const rateLimitKey = REDIS_KEYS.queue.rateLimit(currentSecond);
            const currentCount = parseInt(await redis.get(rateLimitKey) || '0', 10);

            const availableTokens = Math.max(0, rateLimitMax - currentCount);
            if (availableTokens <= 0) {
                // Rate limit reached for this second; wait for next tick
                return;
            }

            // 2. Determine weighted pull quotas for this batch
            // High priority gets up to highWeight; Low gets up to lowWeight
            const targetHighCount = Math.min(availableTokens, highWeight);
            const targetLowCount = Math.min(availableTokens - targetHighCount, lowWeight);

            // 3. Dequeue jobs atomically from Redis lists using RPOPLPUSH
            const jobsToProcess = [];

            // A. Pull High Priority jobs
            for (let i = 0; i < targetHighCount; i++) {
                const rawJob = await redis.rpoplpush(REDIS_KEYS.queue.high(), REDIS_KEYS.queue.processing());
                if (!rawJob) break; // High queue is currently empty
                jobsToProcess.push(JSON.parse(rawJob));
            }

            // If high queue didn't consume all slots, allow low queue to borrow the remainder
            const remainingTokensForLow = availableTokens - jobsToProcess.length;
            const actualLowQuota = Math.min(remainingTokensForLow, targetLowCount + (targetHighCount - jobsToProcess.length));

            // B. Pull Low Priority jobs
            for (let i = 0; i < actualLowQuota; i++) {
                const rawJob = await redis.rpoplpush(REDIS_KEYS.queue.low(), REDIS_KEYS.queue.processing());
                if (!rawJob) break; // Low queue is empty
                jobsToProcess.push(JSON.parse(rawJob));
            }

            if (jobsToProcess.length === 0) {
                return; // Nothing to process in this second
            }

            // Increment atomic rate-limit counter in Redis for this second
            const pipeline = redis.pipeline();
            pipeline.incrby(rateLimitKey, jobsToProcess.length);
            pipeline.expire(rateLimitKey, 3); // 3 seconds expiry is enough for 1s window
            await pipeline.exec();

            // 4. Process all pulled jobs in parallel non-blocking I/O
            await Promise.allSettled(
                jobsToProcess.map((job) => this.handleJob(job))
            );

        } catch (err) {
            logger.error({ err: err.message }, 'Unhandled error in queue worker tick');
        } finally {
            this.isProcessingBatch = false;
        }
    }

    /**
     * Process an individual job, handling TTL expiry, dispatch, and retries.
     */
    async handleJob(job) {
        const rawJobString = JSON.stringify(job);
        const procKey = REDIS_KEYS.queue.processing();

        try {
            // Check TTL: Drop stale jobs if expired (e.g., OTP code validity window passed)
            if (job.expiresAt && Date.now() > job.expiresAt) {
                logger.warn({ jobId: job.id, type: job.type, to: job.to }, 'Dropping expired email job from queue');
                await redis.lrem(procKey, 1, rawJobString);
                return;
            }

            // Dispatch Email
            const result = await dispatchEmailJob(job);

            if (result.success) {
                // Successful send: Acknowledge & remove from processing list
                await redis.lrem(procKey, 1, rawJobString);
                logger.info({ jobId: job.id, type: job.type, to: job.to }, 'Email job successfully processed');
            } else {
                // Dispatch failed: Increment attempt count and retry or route to DLQ
                await this.handleJobFailure(job, rawJobString, result.error);
            }
        } catch (err) {
            await this.handleJobFailure(job, rawJobString, err.message);
        }
    }

    /**
     * Handles retry scheduling or Dead Letter Queue routing on failure.
     */
    async handleJobFailure(job, rawJobString, errorMessage) {
        const procKey = REDIS_KEYS.queue.processing();
        job.attempts = (job.attempts || 0) + 1;

        // Atomically remove from processing queue
        await redis.lrem(procKey, 1, rawJobString);

        if (job.attempts >= (job.maxAttempts || 3)) {
            // Exceeded max retries -> Move to Dead Letter Queue (DLQ)
            job.lastError = errorMessage;
            await redis.lpush(REDIS_KEYS.queue.dlq(), JSON.stringify(job));
            logger.error(
                { jobId: job.id, type: job.type, to: job.to, attempts: job.attempts, err: errorMessage },
                'Email job exceeded max attempts; moved to DLQ'
            );
        } else {
            // Re-queue into high or low queue for retry
            const targetQueue = job.priority === 'low' ? REDIS_KEYS.queue.low() : REDIS_KEYS.queue.high();
            job.lastError = errorMessage;
            await redis.lpush(targetQueue, JSON.stringify(job));
            logger.warn(
                { jobId: job.id, type: job.type, attempt: job.attempts, err: errorMessage },
                'Email job failed; re-enqueued for retry'
            );
        }
    }
}

export const customQueueWorker = new CustomQueueWorker();
export default customQueueWorker;
