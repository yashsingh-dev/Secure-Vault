import { CONSTANTS } from '../../../config/constants.js';
import customQueueProducer from './custom/producer.js';
import customQueueWorker from './custom/worker.js';

/**
 * Valid priority levels for email jobs.
 */
export const EMAIL_PRIORITIES = {
    HIGH: 'high',   
    LOW: 'low'
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
 * Default Priority Mapping for Email Job Types.
 * Real-time security codes (OTP, Password Reset) are High priority.
 * Notifications and marketing (Login Alerts, Welcome) are Low priority.
 */
export const DEFAULT_JOB_PRIORITIES = {
    [EMAIL_JOB_TYPES.OTP]: EMAIL_PRIORITIES.HIGH,
    [EMAIL_JOB_TYPES.PASSWORD_RESET]: EMAIL_PRIORITIES.HIGH,
    [EMAIL_JOB_TYPES.LOGIN_ALERT]: EMAIL_PRIORITIES.LOW,
    [EMAIL_JOB_TYPES.WELCOME]: EMAIL_PRIORITIES.LOW
};

const driver = CONSTANTS.QUEUE?.DRIVER || 'custom';

/**
 * Unified Email Notification Queue Service Entry Point (Facade / Adapter)
 */
const emailNotificationService = {
    /**
     * Enqueue an email job into the active queue driver.
     * Automatically resolves priority from DEFAULT_JOB_PRIORITIES based on jobParams.type,
     * unless an explicit priority is passed to bypass the mapping.
     * 
     * @param {Object} jobParams
     * @param {string} jobParams.type - e.g. EMAIL_JOB_TYPES.OTP
     * @param {string} jobParams.to - Recipient email
     * @param {Object} jobParams.payload - e.g. { otp: 123456 }
     * @param {string} [jobParams.priority] - Optional override: 'high' or 'low'
     * @param {number} [jobParams.ttlSeconds=300]
     */
    async addEmailJob(jobParams) {
        const resolvedPriority = jobParams.priority || DEFAULT_JOB_PRIORITIES[jobParams.type] || EMAIL_PRIORITIES.HIGH;
        const normalizedParams = {
            ...jobParams,
            priority: resolvedPriority
        };

        if (driver === 'custom') return await customQueueProducer.addJob(normalizedParams);
        // BullMQ driver integration will plug in here
    },

    /**
     * Start the background queue consumer worker.
     */
    startWorker() {
        if (driver === 'custom') customQueueWorker.start();
        // BullMQ driver worker will start here
    },

    /**
     * Stop the background queue consumer worker cleanly.
     */
    stopWorker() {
        if (driver === 'custom') customQueueWorker.stop();
        // BullMQ driver worker will stop here
    },

    /**
     * Get queue metrics / lengths
     */
    async getMetrics() {
        if (driver === 'custom') return await customQueueProducer.getQueueLengths();
    }
};

export default emailNotificationService;
