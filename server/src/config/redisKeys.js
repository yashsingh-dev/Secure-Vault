export const REDIS_KEYS = {
    // Top-level key namespace prefixes
    PREFIX: {
        BLACKLIST: 'blacklist',
        SESSION: 'session',
        USER_BLOCK: 'user:block',       // Bucket 1: Temporary lockout/block state
        USER_OTP: 'user:otp',           // Bucket 2: Transient OTP code, attempts, cooldown
        USER_PROFILE: 'user:profile',   // Bucket 3: User document / dashboard profile
        USER_RESET_TOKEN: 'user:reset:token', // Bucket 4: Standalone password reset token
        EMAIL_LOOKUP: 'email:to:id',    // Secondary Index: email -> userId
        RATE_LIMIT: 'rl',               // Rate limit namespace prefix
        QUEUE: 'queue:email'            // Email queue namespace
    },

    blacklist: (tokenHash) => `${REDIS_KEYS.PREFIX.BLACKLIST}:${tokenHash}`,
    session: (sessionId) => `${REDIS_KEYS.PREFIX.SESSION}:${sessionId}`,

    // 1. Bucket 1: User Block Information
    userBlock: (userId) => `${REDIS_KEYS.PREFIX.USER_BLOCK}:${userId}`,

    // 2. Bucket 2: User OTP Information
    userOtp: (userId) => `${REDIS_KEYS.PREFIX.USER_OTP}:${userId}`,

    // 3. Bucket 3: User Profile Document
    userProfile: (userId) => `${REDIS_KEYS.PREFIX.USER_PROFILE}:${userId}`,

    // 4. Bucket 4: User Reset Token (Standalone Key)
    userResetToken: (userId) => `${REDIS_KEYS.PREFIX.USER_RESET_TOKEN}:${userId}`,

    // 5. Secondary Index: Email to User ID Lookup
    emailToId: (email) => `${REDIS_KEYS.PREFIX.EMAIL_LOOKUP}:${email.trim().toLowerCase()}`,

    // 6. Rate Limit Key Helper
    rateLimit: (prefix, identifier) => `${REDIS_KEYS.PREFIX.RATE_LIMIT}:${prefix}:${identifier}`,

    // 7. Custom Email Queue Lists
    queue: {
        high: () => `${REDIS_KEYS.PREFIX.QUEUE}:high`,
        low: () => `${REDIS_KEYS.PREFIX.QUEUE}:low`,
        processing: () => `${REDIS_KEYS.PREFIX.QUEUE}:processing`,
        dlq: () => `${REDIS_KEYS.PREFIX.QUEUE}:dlq`,
        rateLimit: (sec) => `${REDIS_KEYS.PREFIX.QUEUE}:ratelimit:${sec}`,
        workerHeartbeat: () => `${REDIS_KEYS.PREFIX.QUEUE}:worker:heartbeat`
    }
};

export default REDIS_KEYS;
