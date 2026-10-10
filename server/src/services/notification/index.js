import emailNotificationService, { EMAIL_PRIORITIES, EMAIL_JOB_TYPES } from './email/index.js';

export {
    emailNotificationService,
    EMAIL_PRIORITIES,
    EMAIL_JOB_TYPES
};

export default {
    email: emailNotificationService
};
