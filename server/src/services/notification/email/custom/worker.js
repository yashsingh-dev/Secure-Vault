import redis from '../../../../db/redis.js';
import REDIS_KEYS from '../../../../config/redisKeys.js';
import { CONSTANTS } from '../../../../config/constants.js';
import { logger } from '../../../../lib/logger.js';
import userModel from '../../../../models/user.model.js';
import { EMAIL_JOB_TYPES } from '../index.js';
import dispatchEmailJob from '../jobDispatcher.js';

/**
 * Atomic Token Reservation Lua Script
 * 
 * Atomically checks the current second bucket, grants available tokens up to
 * the requested amount, increments the key by the granted amount, and sets TTL.
 * 
 * KEYS[1] -> Rate limit key for current second: "queue:email:ratelimit:<currentSecond>"
 * ARGV[1] -> Rate limit ceiling: e.g. 10
 * ARGV[2] -> Requested tokens: e.g. 10
 * 
 * Returns: Number of tokens successfully granted (0 if limit reached)
 */
const ACQUIRE_TOKENS_LUA = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local maxLimit = tonumber(ARGV[1])
local requested = tonumber(ARGV[2])

local available = maxLimit - current
if available <= 0 then
    return 0
end

local granted = math.min(available, requested)
redis.call('INCRBY', KEYS[1], granted)
redis.call('EXPIRE', KEYS[1], 3)

return granted
`;

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
            { intervalMs: this.intervalMs, rateLimitPerSec: CONSTANTS.QUEUE?.EMAIL_RATE_LIMIT_PER_SEC },
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
     * If the entire server cluster crashed mid-send, return stranded jobs from
     * processing list back into high priority queue.
     * 
     * Solution A (Distributed Heartbeat Lock):
     * If another server instance has been active within the last 5 seconds,
     * skip recovery to avoid stealing active in-flight jobs from living instances.
     */
    async recoverStrandedJobs() {
        const heartbeatKey = REDIS_KEYS.queue.workerHeartbeat();
        const activeWorkerDetected = await redis.get(heartbeatKey);

        if (activeWorkerDetected) {
            logger.info('Active worker heartbeat detected from another running instance. Skipping stranded job recovery.');
            return;
        }

        const procKey = REDIS_KEYS.queue.processing();
        const highKey = REDIS_KEYS.queue.high();
        let recovered = 0;

        while (true) {
            // Push every job from processing back to high queue, regarding it as high priority
            // This is safe because the job is already considered processed once
            const rawJob = await redis.rpoplpush(procKey, highKey);
            if (!rawJob) break;
            recovered++;
        }

        if (recovered > 0) {
            logger.info({ recoveredCount: recovered }, 'Recovered stranded in-flight jobs back to high queue');
        } else {
            logger.info('No stranded jobs to recover');
        }
    }

    /**
     * The 1-second Tick Execution:
     * 1. Atomic token reservation (via Lua script across all instances).
     * 2. Weighted quota calculation (High vs. Low priority).
     * 3. Atomic pop to processing list.
     * 4. Parallel dispatch (Promise.allSettled).
     * 5. Unused token refunding and acknowledgment handling.
     */
    async tick() {
        // Prevent overlapping batch execution if an async cycle exceeds 1000ms
        if (this.isProcessingBatch || !this.isRunning) return;
        this.isProcessingBatch = true;

        try {
            // Heartbeat: Announce this worker instance is alive (5 second TTL)
            // Used by recoverStrandedJobs to prevent restarting instances from stealing in-flight jobs
            await redis.set(REDIS_KEYS.queue.workerHeartbeat(), 'alive', 'EX', 5);

            const rateLimitMax = CONSTANTS.QUEUE?.EMAIL_RATE_LIMIT_PER_SEC;
            const highWeight = CONSTANTS.QUEUE?.HIGH_PRIORITY_WEIGHT;
            const lowWeight = CONSTANTS.QUEUE?.LOW_PRIORITY_WEIGHT;

            // 1. Inspect queue lengths first to calculate exact tokens needed
            const [highPending, lowPending] = await Promise.all([
                redis.llen(REDIS_KEYS.queue.high()),
                redis.llen(REDIS_KEYS.queue.low())
            ]);

            const totalJobsWaiting = highPending + lowPending;
            if (totalJobsWaiting === 0) {
                return; // Nothing in queue; avoid claiming tokens unnecessarily
            }

            // Request only what we can actually process in this tick (capped at rateLimitMax)
            const tokensNeeded = Math.min(totalJobsWaiting, rateLimitMax);

            // 2. Atomically claim ONLY the required tokens for this second via Redis Lua script
            const currentSecond = Math.floor(Date.now() / 1000);
            const rateLimitKey = REDIS_KEYS.queue.rateLimit(currentSecond);

            const grantedTokens = await redis.eval(
                ACQUIRE_TOKENS_LUA,
                1,
                rateLimitKey,
                rateLimitMax,
                tokensNeeded // Request only what we need so other instances can share remaining tokens!
            );

            // If 0 tokens granted, other server instances have already filled this second's quota
            if (!grantedTokens || grantedTokens <= 0) {
                return;
            }

            // 3. Determine weighted pull quotas based on exclusively granted tokens
            const targetHighCount = Math.min(grantedTokens, highWeight);
            const targetLowCount = Math.min(grantedTokens - targetHighCount, lowWeight);

            // 4. Dequeue jobs atomically from Redis lists using RPOPLPUSH
            const jobsToProcess = [];

            // A. Pull High Priority jobs
            for (let i = 0; i < targetHighCount; i++) {
                const rawJob = await redis.rpoplpush(REDIS_KEYS.queue.high(), REDIS_KEYS.queue.processing());
                if (!rawJob) break; // High queue is currently empty
                jobsToProcess.push({ job: JSON.parse(rawJob), rawString: rawJob });
            }

            // If high queue didn't consume all slots, allow low queue to borrow remainder
            const remainingTokensForLow = grantedTokens - jobsToProcess.length;
            const actualLowQuota = Math.min(remainingTokensForLow, targetLowCount + (targetHighCount - jobsToProcess.length));

            // B. Pull Low Priority jobs
            for (let i = 0; i < actualLowQuota; i++) {
                const rawJob = await redis.rpoplpush(REDIS_KEYS.queue.low(), REDIS_KEYS.queue.processing());
                if (!rawJob) break; // Low queue is empty
                jobsToProcess.push({ job: JSON.parse(rawJob), rawString: rawJob });
            }

            // 5. Refund any unused tokens back to Redis so other servers can use them in this second
            const unusedTokens = grantedTokens - jobsToProcess.length;
            if (unusedTokens > 0) {
                await redis.decrby(rateLimitKey, unusedTokens);
            }

            if (jobsToProcess.length === 0) {
                return; // Nothing to process in this second
            }

            // 6. Process all pulled jobs in parallel non-blocking I/O
            await Promise.allSettled(
                jobsToProcess.map(({ job, rawString }) => this.handleJob(job, rawString))
            );

        } catch (err) {
            logger.error({ err: err.message }, 'Unhandled error in queue worker tick');
        } finally {
            this.isProcessingBatch = false;
        }
    }

    /**
     * Process an individual job, handling TTL expiry, dispatch, and retries.
     * @param {Object} job - Parsed job object
     * @param {string} rawString - Exact original serialized string from Redis
     */
    async handleJob(job, rawString) {
        const procKey = REDIS_KEYS.queue.processing();

        try {
            // Check TTL: Drop stale jobs if expired (e.g., OTP code validity window passed)
            if (job.expiresAt && Date.now() > job.expiresAt) {
                logger.warn({ jobId: job.id, type: job.type, to: job.to }, 'Dropping expired email job from queue');
                await redis.lrem(procKey, 1, rawString);
                return;
            }

            // Dispatch Email
            const result = await dispatchEmailJob(job);

            if (result.success) {
                // Successful send: Acknowledge & remove from processing list using original exact string
                await redis.lrem(procKey, 1, rawString);
                logger.info({ jobId: job.id, type: job.type, to: job.to }, 'Email job successfully processed');
            } else {
                // Dispatch failed: Increment attempt count and retry or route to DLQ
                await this.handleJobFailure(job, rawString, result.error);
            }
        } catch (err) {
            await this.handleJobFailure(job, rawString, err.message);
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

        if (job.attempts >= (job.maxAttempts || CONSTANTS.QUEUE?.MAX_ATTEMPTS || 3)) {
            // Exceeded max retries -> Move to Dead Letter Queue (DLQ)
            job.lastError = errorMessage;
            await redis.lpush(REDIS_KEYS.queue.dlq(), JSON.stringify(job));
            logger.error(
                { jobId: job.id, type: job.type, to: job.to, attempts: job.attempts, err: errorMessage },
                'Email job exceeded max attempts; moved to DLQ'
            );

            // Roll back user OTP state in MongoDB & Redis so the user is not stuck on a dead cooldown
            if (job.type === EMAIL_JOB_TYPES.OTP && job.payload?.userId) {
                try {
                    const userId = job.payload.userId;
                    await Promise.all([
                        userModel.updateOne(
                            { _id: userId },
                            { $set: { otp: null, otpExpiry: null, otpCoolDown: null, otpAttempts: 0 } }
                        ),
                        redis.del(REDIS_KEYS.userOtp(userId))
                    ]);
                    logger.info(
                        { userId, recipient: job.to },
                        'Successfully rolled back user OTP state in DB and Redis after delivery exhaustion'
                    );
                } catch (rollbackErr) {
                    logger.error(
                        { err: rollbackErr.message, userId: job.payload?.userId },
                        'Failed to roll back user OTP state after job exhaustion'
                    );
                }
            }
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
