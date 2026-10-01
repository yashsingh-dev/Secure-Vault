export const REDIS_KEYS = {
    // Top-level key namespace prefixes
    PREFIX: {
        BLACKLIST: 'blacklist',
        SESSION: 'session',
        USER_BLOCK: 'user:block',       // Bucket 1: Temporary lockout/block state
        USER_OTP: 'user:otp',           // Bucket 2: Transient OTP code, attempts, cooldown
        USER_PROFILE: 'user:profile',   // Bucket 3: User document / dashboard profile
        EMAIL_LOOKUP: 'email:to:id'     // Secondary Index: email -> userId
    },

    blacklist: (tokenHash) => `${REDIS_KEYS.PREFIX.BLACKLIST}:${tokenHash}`,
    session: (sessionId) => `${REDIS_KEYS.PREFIX.SESSION}:${sessionId}`,

    // 1. Bucket 1: User Block Information
    userBlock: (userId) => `${REDIS_KEYS.PREFIX.USER_BLOCK}:${userId}`,

    // 2. Bucket 2: User OTP Information
    userOtp: (userId) => `${REDIS_KEYS.PREFIX.USER_OTP}:${userId}`,

    // 3. Bucket 3: User Profile Document
    userProfile: (userId) => `${REDIS_KEYS.PREFIX.USER_PROFILE}:${userId}`,

    // 4. Secondary Index: Email to User ID Lookup
    emailToId: (email) => `${REDIS_KEYS.PREFIX.EMAIL_LOOKUP}:${email.trim().toLowerCase()}`
};

export default REDIS_KEYS;
