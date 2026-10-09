import { sendOTPEmail, sendLoginAlertEmail, sendWelcomeEmail } from '../../../utils/sendMail.utils.js';
import { EMAIL_JOB_TYPES } from './customQueueProducer.js';
import { logger } from '../../../lib/logger.js';

/**
 * Dispatch an email job according to its type.
 * Returns { success: boolean, error?: string }
 */
export async function dispatchEmailJob(job) {
    try {
        switch (job.type) {
            case EMAIL_JOB_TYPES.OTP: {
                const otp = job.payload?.otp;
                if (!otp) {
                    throw new Error('Missing OTP code in job payload');
                }
                const result = await sendOTPEmail(job.to, otp);
                if (!result.success) {
                    throw new Error(result.error?.message || 'Failed to dispatch OTP email');
                }
                return { success: true };
            }

            case EMAIL_JOB_TYPES.LOGIN_ALERT: {
                const ip = job.payload?.ip || 'Unknown IP';
                const device = job.payload?.device || 'Unknown Device';
                const time = job.payload?.time || new Date().toUTCString();

                const result = await sendLoginAlertEmail(job.to, { ip, device, time });
                if (!result.success) {
                    throw new Error(result.error?.message || 'Failed to dispatch login alert email');
                }
                return { success: true };
            }

            case EMAIL_JOB_TYPES.WELCOME: {
                const name = job.payload?.name || 'there';
                const dashboardUrl = job.payload?.dashboardUrl;

                const result = await sendWelcomeEmail(job.to, { name, dashboardUrl });
                if (!result.success) {
                    throw new Error(result.error?.message || 'Failed to dispatch welcome email');
                }
                return { success: true };
            }

            default:
                logger.warn({ jobType: job.type, jobId: job.id }, 'Unhandled email job type in dispatcher');
                return { success: true };
        }
    } catch (err) {
        logger.error({ err: err.message, jobId: job.id, type: job.type, to: job.to }, 'Email dispatch failed');
        return { success: false, error: err.message };
    }
}

export default dispatchEmailJob;
