import { CONSTANTS } from '../../../config/constants.js';
import customQueueProducer, { EMAIL_PRIORITIES, EMAIL_JOB_TYPES } from './custom/producer.js';
import customQueueWorker from './custom/worker.js';

const driver = CONSTANTS.QUEUE?.DRIVER || 'custom';

/**
 * Unified Email Notification Queue Service Entry Point (Facade / Adapter)
 */
const emailNotificationService = {
    /**
     * Enqueue an email job into the active queue driver.
     * 
     * @param {Object} jobParams
     * @param {string} jobParams.type - e.g. EMAIL_JOB_TYPES.OTP
     * @param {string} jobParams.to - Recipient email
     * @param {Object} jobParams.payload - e.g. { otp: 123456 }
     * @param {string} [jobParams.priority='high'] - 'high' or 'low'
     * @param {number} [jobParams.ttlSeconds=300]
     */
    async addEmailJob(jobParams) {
        if (driver === 'custom') return await customQueueProducer.addJob(jobParams);
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

export { EMAIL_PRIORITIES, EMAIL_JOB_TYPES };
export default emailNotificationService;
