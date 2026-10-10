import { Worker } from 'bullmq';
import { QUEUE_NAME, bullmqConnection } from './producer.js';
import { CONSTANTS } from '../../../../config/constants.js';
import { logger } from '../../../../lib/logger.js';
import redis from '../../../../db/redis.js';
import REDIS_KEYS from '../../../../config/redisKeys.js';
import userModel from '../../../../models/user.model.js';
import { EMAIL_JOB_TYPES } from '../index.js';
import dispatchEmailJob from '../jobDispatcher.js';

class BullmqWorker {
    constructor() {
        this.worker = null;
        this.isRunning = false;
    }

    /**
     * Start the BullMQ background worker.
     */
    start() {
        if (this.isRunning) {
            logger.warn('BullmqWorker is already running.');
            return;
        }

        const rateLimitMax = CONSTANTS.QUEUE?.EMAIL_RATE_LIMIT_PER_SEC || 7;

        this.worker = new Worker(
            QUEUE_NAME,
            async (job) => {
                // 1. Check TTL Expiry: drop stale jobs
                if (job.data?.expiresAt && Date.now() > job.data.expiresAt) {
                    logger.warn(
                        { jobId: job.id, type: job.data.type, to: job.data.to },
                        'Dropping expired email job from BullMQ queue'
                    );
                    return;
                }

                // 2. Dispatch Email
                const result = await dispatchEmailJob({
                    id: job.id,
                    type: job.data.type,
                    to: job.data.to,
                    payload: job.data.payload
                });

                if (!result.success) {
                    throw new Error(result.error || 'Failed to dispatch email');
                }

                logger.info(
                    { jobId: job.id, type: job.data.type, to: job.data.to },
                    'BullMQ email job successfully processed'
                );
            },
            {
                connection: bullmqConnection,
                concurrency: CONSTANTS.QUEUE?.EMAIL_WORKER_CONCURRENCY || 20,
                limiter: {
                    max: rateLimitMax,
                    duration: 1000 // Distributed 1-second sliding bucket
                }
            }
        );

        this.worker.on('completed', (job) => {
            logger.info({ jobId: job.id, type: job.data?.type }, 'BullMQ email job completed');
        });

        this.worker.on('failed', async (job, err) => {
            const maxAttempts = job?.opts?.attempts || CONSTANTS.QUEUE?.MAX_ATTEMPTS || 3;
            const attemptsMade = job?.attemptsMade || 0;

            logger.error(
                { jobId: job?.id, type: job?.data?.type, attemptsMade, maxAttempts, err: err.message },
                'BullMQ email job attempt failed'
            );

            // Handle final exhaustion (DLQ equivalent)
            if (job && attemptsMade >= maxAttempts) {
                logger.error(
                    { jobId: job.id, type: job.data?.type, to: job.data?.to },
                    'BullMQ email job exceeded max attempts; moved to failed state'
                );

                // Roll back user OTP state in MongoDB & Redis so the user is not stuck on a dead cooldown
                if (job.data?.type === EMAIL_JOB_TYPES.OTP && job.data?.payload?.userId) {
                    try {
                        const userId = job.data.payload.userId;
                        await Promise.all([
                            userModel.updateOne(
                                { _id: userId },
                                { $set: { otp: null, otpExpiry: null, otpCoolDown: null, otpAttempts: 0 } }
                            ),
                            redis.del(REDIS_KEYS.userOtp(userId))
                        ]);
                        logger.info(
                            { userId, recipient: job.data.to },
                            'Successfully rolled back user OTP state in DB and Redis after BullMQ delivery exhaustion'
                        );
                    } catch (rollbackErr) {
                        logger.error(
                            { err: rollbackErr.message, userId: job.data.payload?.userId },
                            'Failed to roll back user OTP state after BullMQ job exhaustion'
                        );
                    }
                }
            }
        });

        this.worker.on('error', (err) => {
            logger.error({ err: err.message }, 'BullMQ worker encountered internal error');
        });

        this.isRunning = true;
        logger.info(
            { queue: QUEUE_NAME, rateLimitPerSec: rateLimitMax },
            'BullmqWorker started successfully'
        );
    }

    /**
     * Gracefully stop the worker, waiting for in-flight jobs to complete.
     */
    async stop() {
        if (!this.isRunning || !this.worker) return;
        this.isRunning = false;
        await this.worker.close();
        this.worker = null;
        logger.info('BullmqWorker stopped.');
    }
}

export const bullmqWorker = new BullmqWorker();
export default bullmqWorker;
