export const CONSTANTS = {
    NAME: {
        ACCESS_TOKEN: 'accessToken',
        REFRESH_TOKEN: 'refreshToken'
    },
    AUTH_TOKEN: {
        ACCESS_TOKEN: '1h',
        REFRESH_TOKEN: '1d',
        LONG_REFRESH_TOKEN: '7d',
        ACCESS_TOKEN_MS: 1 * 60 * 60 * 1000, // 1 hour
        REFRESH_TOKEN_MS: 1 * 24 * 60 * 60 * 1000, // 1 day
        LONG_REFRESH_TOKEN_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
        BLACKLIST_TOKEN: 1 * 60 * 60 // 1 hour
    },
    OTP: {
        TESTING: false,
        LENGTH: 6,
        EXPIRY_MS: 15 * 60 * 1000, // 15 minutes
        COOL_DOWN_MS: 60 * 1000, // 1 minute
        BLOCK_TIME_MS: 5 * 60 * 1000, // 5 minutes
        RESET_TOKEN: '10m',
    },
    PASSWORD: {
        MIN_LENGTH: 8,
    }
};
