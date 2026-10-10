import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bullmqProducer, emailQueue } from '../../../src/services/notification/email/bullmq/producer.js';
import { bullmqWorker } from '../../../src/services/notification/email/bullmq/worker.js';
import emailNotificationService, { EMAIL_JOB_TYPES, EMAIL_PRIORITIES, DEFAULT_JOB_PRIORITIES } from '../../../src/services/notification/email/index.js';

describe('Unit: BullMQ Email Notification System', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await bullmqWorker.stop();
    });

    describe('BullMQ Producer', () => {
        it('should require a recipient email address', async () => {
            const result = await bullmqProducer.addJob({
                type: EMAIL_JOB_TYPES.OTP,
                to: ''
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Recipient email address is required');
        });

        it('should map high priority jobs to BullMQ priority 1', async () => {
            const addSpy = vi.spyOn(emailQueue, 'add').mockResolvedValueOnce({ id: 'bull-job-1' });

            const result = await bullmqProducer.addJob({
                type: EMAIL_JOB_TYPES.OTP,
                to: 'test@example.com',
                payload: { otp: 123456 }
            });

            expect(result.success).toBe(true);
            expect(result.jobId).toBe('bull-job-1');
            expect(result.priority).toBe(EMAIL_PRIORITIES.HIGH);

            expect(addSpy).toHaveBeenCalledWith(
                EMAIL_JOB_TYPES.OTP,
                expect.objectContaining({
                    type: EMAIL_JOB_TYPES.OTP,
                    to: 'test@example.com',
                    priority: EMAIL_PRIORITIES.HIGH
                }),
                expect.objectContaining({
                    priority: 1
                })
            );
        });

        it('should map low priority jobs to BullMQ priority 2', async () => {
            const addSpy = vi.spyOn(emailQueue, 'add').mockResolvedValueOnce({ id: 'bull-job-2' });

            const result = await bullmqProducer.addJob({
                type: EMAIL_JOB_TYPES.LOGIN_ALERT,
                to: 'test@example.com',
                payload: { ip: '127.0.0.1' }
            });

            expect(result.success).toBe(true);
            expect(result.priority).toBe(EMAIL_PRIORITIES.LOW);

            expect(addSpy).toHaveBeenCalledWith(
                EMAIL_JOB_TYPES.LOGIN_ALERT,
                expect.objectContaining({
                    type: EMAIL_JOB_TYPES.LOGIN_ALERT,
                    priority: EMAIL_PRIORITIES.LOW
                }),
                expect.objectContaining({
                    priority: 2
                })
            );
        });

        it('should allow bypassing default priority when explicitly passed', async () => {
            const addSpy = vi.spyOn(emailQueue, 'add').mockResolvedValueOnce({ id: 'bull-job-3' });

            // LOGIN_ALERT is by default LOW, but we explicitly pass HIGH
            const result = await bullmqProducer.addJob({
                type: EMAIL_JOB_TYPES.LOGIN_ALERT,
                to: 'test@example.com',
                priority: EMAIL_PRIORITIES.HIGH
            });

            expect(result.success).toBe(true);
            expect(result.priority).toBe(EMAIL_PRIORITIES.HIGH);
            expect(addSpy).toHaveBeenCalledWith(
                EMAIL_JOB_TYPES.LOGIN_ALERT,
                expect.anything(),
                expect.objectContaining({
                    priority: 1
                })
            );
        });

        it('should return queue metric counts correctly', async () => {
            vi.spyOn(emailQueue, 'getJobCounts').mockResolvedValueOnce({
                waiting: 3,
                active: 1,
                failed: 0,
                delayed: 2,
                prioritized: 1
            });

            const metrics = await bullmqProducer.getQueueLengths();
            expect(metrics.waiting).toBe(3);
            expect(metrics.active).toBe(1);
            expect(metrics.totalPending).toBe(6);
        });
    });

    describe('BullMQ Worker Lifecycle', () => {
        it('should start and stop the worker cleanly', async () => {
            bullmqWorker.start();
            expect(bullmqWorker.isRunning).toBe(true);

            // Starting again should be idempotent
            bullmqWorker.start();
            expect(bullmqWorker.isRunning).toBe(true);

            await bullmqWorker.stop();
            expect(bullmqWorker.isRunning).toBe(false);
        });
    });

    describe('Priority Configuration Maps', () => {
        it('should have correct default mappings defined', () => {
            expect(DEFAULT_JOB_PRIORITIES[EMAIL_JOB_TYPES.OTP]).toBe(EMAIL_PRIORITIES.HIGH);
            expect(DEFAULT_JOB_PRIORITIES[EMAIL_JOB_TYPES.PASSWORD_RESET]).toBe(EMAIL_PRIORITIES.HIGH);
            expect(DEFAULT_JOB_PRIORITIES[EMAIL_JOB_TYPES.LOGIN_ALERT]).toBe(EMAIL_PRIORITIES.LOW);
            expect(DEFAULT_JOB_PRIORITIES[EMAIL_JOB_TYPES.WELCOME]).toBe(EMAIL_PRIORITIES.LOW);
        });
    });
});
