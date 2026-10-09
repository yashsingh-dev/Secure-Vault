import { CONSTANTS } from '../../config/constants.js';
import customQueueProducer, { EMAIL_PRIORITIES, EMAIL_JOB_TYPES } from './custom/customQueueProducer.js';
import customQueueWorker from './custom/customWorker.js';

const driver = CONSTANTS.QUEUE?.DRIVER || 'custom';

/**
 * Unified Queue Service Entry Point (Facade / Adapter)
 */
const queueService = {
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
    },

    /**
     * Start the background queue consumer worker.
     */
    startWorker() {
        if (driver === 'custom') customQueueWorker.start();
    },

    /**
     * Stop the background queue consumer worker cleanly.
     */
    stopWorker() {
        if (driver === 'custom') customQueueWorker.stop();
    },

    /**
     * Get queue metrics / lengths
     */
    async getMetrics() {
        return await customQueueProducer.getQueueLengths();
    }
};

export { EMAIL_PRIORITIES, EMAIL_JOB_TYPES };
export default queueService;
