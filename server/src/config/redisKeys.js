export const REDIS_KEYS = {
    // Top-level key namespace prefixes
    PREFIX: {
        BLACKLIST: 'blacklist',
        USER_TOKEN_VERSION: 'user:token_version',
        SESSION: 'session'
    },

    // Builder functions to generate keys safely without typos or magic strings
    blacklist: (tokenHash) => `${REDIS_KEYS.PREFIX.BLACKLIST}:${tokenHash}`,
    userTokenVersion: (userId) => `${REDIS_KEYS.PREFIX.USER_TOKEN_VERSION}:${userId}`,
    session: (sessionId) => `${REDIS_KEYS.PREFIX.SESSION}:${sessionId}`
};

export default REDIS_KEYS;
