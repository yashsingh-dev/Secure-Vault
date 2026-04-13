export const CONSTANTS = {
    AUTH_TOKEN: {
        ACCESS_TOKEN: '1h',
        REFRESH_TOKEN: '1d',
        LONG_REFRESH_TOKEN: '7d',
        RESET_TOKEN: '10m',
        ACCESS_TOKEN_MS: 1 * 60 * 60 * 1000, // 1 hour
        REFRESH_TOKEN_MS: 1 * 24 * 60 * 60 * 1000, // 1 day
        LONG_REFRESH_TOKEN_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
        BLACKLIST_TOKEN_MS: 1 * 60 * 60 * 1000 // 1 hour
    },
    OTP: {
        TESTING: true,
        LENGTH: 6,
        EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
        COOL_DOWN_MS: 60 * 1000, // 1 minute
        BLOCK_TIME_MS: 5 * 60 * 1000 // 5 minutes
    }
};
