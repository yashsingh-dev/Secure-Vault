export const CONSTANTS = {
    NAME: {
        ACCESS_TOKEN: '__Host-sv_at',
        REFRESH_TOKEN: '__Host-sv_rt'
    },
    AUTH_TOKEN: {
        ACCESS_TOKEN: '20m',
        // ACCESS_TOKEN: '2m',
        REFRESH_TOKEN: '1d',
        LONG_REFRESH_TOKEN: '7d',
        ACCESS_TOKEN_MS: 20 * 60 * 1000, // 20 minutes
        // ACCESS_TOKEN_MS: 2 * 60 * 1000, // 2 minute
        REFRESH_TOKEN_MS: 1 * 24 * 60 * 60 * 1000, // 1 day
        LONG_REFRESH_TOKEN_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
        BLACKLIST_TOKEN: 10 * 60 // 10 minutes (600 seconds)
    },
    OTP: {
        TESTING: true,
        LENGTH: 6,
        EXPIRY_MS: 15 * 60 * 1000, // 15 minutes
        COOL_DOWN_MS: 60 * 1000, // 1 minute
        RESET_TOKEN: '10m',
        MAX_ATTEMPTS: 5,
        BLOCK_TIME_MS: 5 * 60 * 1000 // 5 minutes
    },
    PASSWORD: {
        MIN_LENGTH: 8,
    }
};
