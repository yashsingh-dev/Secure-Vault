import { CONSTANTS } from '../../config/constants.js';
import customQueueProducer, { EMAIL_PRIORITIES, EMAIL_JOB_TYPES } from './custom/customQueueProducer.js';
import customQueueWorker from './custom/customWorker.js';

/**
 * Unified Queue Service Entry Point (Facade / Adapter)
 * 
 * Future: When CONSTANTS.QUEUE.DRIVER === 'bullmq', this can delegate
 * to BullMQ instead of the custom queue producer/worker seamlessly.
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
        const driver = CONSTANTS.QUEUE?.DRIVER || 'custom';

        if (driver === 'custom') {
            return await customQueueProducer.addJob(jobParams);
        }

        // BullMQ driver placeholder - will plug in once implemented
        return await customQueueProducer.addJob(jobParams);
    },

    /**
     * Start the background queue consumer worker.
     */
    startWorker() {
        const driver = CONSTANTS.QUEUE?.DRIVER || 'custom';
        if (driver === 'custom') {
            customQueueWorker.start();
        }
    },

    /**
     * Stop the background queue consumer worker cleanly.
     */
    stopWorker() {
        const driver = CONSTANTS.QUEUE?.DRIVER || 'custom';
        if (driver === 'custom') {
            customQueueWorker.stop();
        }
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
