import 'dotenv/config';
import { logger } from '../lib/logger.js';
import { CONSTANTS } from './constants.js';

/**
 * Required Environment Keys
 * Server startup will immediately halt if any of these are missing.
 */
const REQUIRED_KEYS = [
    'MONGO_URI',
    'EMAIL_API_KEY',
    'SENDER_EMAIL',
    'OAUTH_GOOGLE_CLIENT_ID',
    'OAUTH_GOOGLE_SECRET',
    'RECAPTCHA_SECRET_KEY',
    'REDIS_URL'
];

/**
 * Optional Environment Keys with safe defaults
 * Warnings will be logged, but the server will continue to start.
 */
const OPTIONAL_KEYS = [
    { key: 'NODE_ENV', default: 'development' },
    { key: 'PORT', default: 3000 },
    { key: 'CLIENT_URL_DEV', default: 'http://localhost:5173' },
    { key: 'JWT_ACCESS_KEY', default: 'default-key' },
    { key: 'JWT_REFRESH_KEY', default: 'default-key' },
    { key: 'JWT_RESET_KEY', default: 'default-key' },
    { key: 'CSRF_SECRET', default: 'default-key' }
];

/**
 * Converts a time string (e.g. '20m', '1d', '7d', '10s', '500ms') into milliseconds.
 * Returns null if the format is invalid.
 * @param {string} timeStr 
 * @returns {number|null}
 */
const parseTimeToMs = (timeStr) => {
    if (typeof timeStr !== 'string') return null;
    const trimmed = timeStr.trim();
    const match = trimmed.match(/^(\d+)\s*(ms|s|m|h|d|w)$/i);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case 'ms': return value;
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'w': return value * 7 * 24 * 60 * 60 * 1000;
        default: return null;
    }
};

/**
 * Validates environment variables.
 * - Exits with status 1 if any required keys are missing.
 * - Sets default values and logs warnings for missing optional keys.
 */
export const validateEnv = () => {
    const missingRequired = [];
    const missingOptional = [];

    // Check required keys
    for (const key of REQUIRED_KEYS) {
        if (!process.env[key] || process.env[key].trim() === '') {
            missingRequired.push(key);
        }
    }

    // Check optional keys and assign defaults if not present
    for (const item of OPTIONAL_KEYS) {
        if (!process.env[item.key] || process.env[item.key].toString().trim() === '') {
            missingOptional.push(item);
            process.env[item.key] = item.default.toString();
        }
    }

    // Log warnings for optional keys
    if (missingOptional.length > 0) {
        logger.warn(
            { missing: missingOptional.map(i => ({ key: i.key, fallback: i.default })) },
            'Optional environment variables missing; fallback defaults applied'
        );
    }

    // If required keys are missing, halt startup
    if (missingRequired.length > 0) {
        logger.fatal(
            { missingKeys: missingRequired },
            'Critical environment configuration error: required variables missing. Halting process'
        );
        process.exit(1);
    }

    logger.info('Environment configuration validated successfully');
};

/**
 * Validates application CONSTANTS integrity at startup.
 * Halts startup immediately if any constant is malformed, missing, or mismatched.
 */
export const validateConstants = () => {
    const errors = [];

    // Helper: Verify non-empty string
    const assertNonEmptyString = (val, path) => {
        if (typeof val !== 'string' || val.trim() === '') {
            errors.push(`${path} must be a non-empty string; received: ${JSON.stringify(val)}`);
        }
    };

    // Helper: Verify positive integer
    const assertPositiveInteger = (val, path) => {
        if (typeof val !== 'number' || !Number.isInteger(val) || val <= 0) {
            errors.push(`${path} must be a positive integer; received: ${JSON.stringify(val)}`);
        }
    };

    // Helper: Verify time string matches its millisecond counterpart
    const assertDurationMatch = (strVal, msVal, strPath, msPath) => {
        assertNonEmptyString(strVal, strPath);
        assertPositiveInteger(msVal, msPath);

        const parsedMs = parseTimeToMs(strVal);
        if (parsedMs === null) {
            errors.push(`${strPath} has an invalid duration format: "${strVal}" (expected format: '20m', '1d', etc.)`);
        } else if (parsedMs !== msVal) {
            errors.push(
                `Mismatch between ${strPath} ("${strVal}" = ${parsedMs}ms) and ${msPath} (${msVal}ms). They must be equivalent.`
            );
        }
    };

    // 1. Validate Cookie / Token Names (Requirement: non-empty string; __Host- warning if missing prefix)
    assertNonEmptyString(CONSTANTS.NAME?.ACCESS_TOKEN, 'CONSTANTS.NAME.ACCESS_TOKEN');
    assertNonEmptyString(CONSTANTS.NAME?.REFRESH_TOKEN, 'CONSTANTS.NAME.REFRESH_TOKEN');

    if (CONSTANTS.NAME?.ACCESS_TOKEN && !CONSTANTS.NAME.ACCESS_TOKEN.startsWith('__Host-')) {
        logger.warn(
            { tokenName: CONSTANTS.NAME.ACCESS_TOKEN },
            'Security Warning: CONSTANTS.NAME.ACCESS_TOKEN does not start with "__Host-" prefix. Recommended for cookie isolation in production.'
        );
    }

    // 2. Validate AUTH_TOKEN durations and string-to-millisecond synchronization
    assertDurationMatch(
        CONSTANTS.AUTH_TOKEN?.ACCESS_TOKEN,
        CONSTANTS.AUTH_TOKEN?.ACCESS_TOKEN_MS,
        'CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN',
        'CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS'
    );

    assertDurationMatch(
        CONSTANTS.AUTH_TOKEN?.REFRESH_TOKEN,
        CONSTANTS.AUTH_TOKEN?.REFRESH_TOKEN_MS,
        'CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN',
        'CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS'
    );

    assertDurationMatch(
        CONSTANTS.AUTH_TOKEN?.LONG_REFRESH_TOKEN,
        CONSTANTS.AUTH_TOKEN?.LONG_REFRESH_TOKEN_MS,
        'CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN',
        'CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS'
    );

    assertPositiveInteger(CONSTANTS.AUTH_TOKEN?.BLACKLIST_TOKEN, 'CONSTANTS.AUTH_TOKEN.BLACKLIST_TOKEN');

    // Requirement 4: REFRESH_TOKEN_MS must always be greater than ACCESS_TOKEN_MS
    if (
        CONSTANTS.AUTH_TOKEN?.REFRESH_TOKEN_MS &&
        CONSTANTS.AUTH_TOKEN?.ACCESS_TOKEN_MS &&
        CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS <= CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS
    ) {
        errors.push(
            `CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS (${CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS}ms) must be strictly greater than ACCESS_TOKEN_MS (${CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS}ms)`
        );
    }

    // Requirement 5: LONG_REFRESH_TOKEN_MS must always be greater than ACCESS_TOKEN_MS
    if (
        CONSTANTS.AUTH_TOKEN?.LONG_REFRESH_TOKEN_MS &&
        CONSTANTS.AUTH_TOKEN?.ACCESS_TOKEN_MS &&
        CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS <= CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS
    ) {
        errors.push(
            `CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS (${CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS}ms) must be strictly greater than ACCESS_TOKEN_MS (${CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS}ms)`
        );
    }

    // 3. Validate RESET_TOKEN duration and string-to-millisecond synchronization
    assertDurationMatch(
        CONSTANTS.RESET_TOKEN?.EXPIRY,
        CONSTANTS.RESET_TOKEN?.EXPIRY_MS,
        'CONSTANTS.RESET_TOKEN.EXPIRY',
        'CONSTANTS.RESET_TOKEN.EXPIRY_MS'
    );

    // 4. Validate OTP configuration
    if (typeof CONSTANTS.OTP?.TESTING !== 'boolean') {
        errors.push(`CONSTANTS.OTP.TESTING must be a boolean; received: ${JSON.stringify(CONSTANTS.OTP?.TESTING)}`);
    } else {
        const currentEnv = (process.env.NODE_ENV || 'development').toLowerCase();
        const isNonProd = ['development', 'test', 'testing'].includes(currentEnv);
        if (isNonProd && CONSTANTS.OTP.TESTING === false) {
            logger.warn(
                { environment: currentEnv, otpTesting: CONSTANTS.OTP.TESTING },
                `Configuration Warning: CONSTANTS.OTP.TESTING is set to false in a ${currentEnv} environment. For local development or automated tests, set OTP.TESTING: true to avoid sending live emails and running into delivery quotas.`
            );
        }
    }
    assertPositiveInteger(CONSTANTS.OTP?.LENGTH, 'CONSTANTS.OTP.LENGTH');
    assertPositiveInteger(CONSTANTS.OTP?.EXPIRY_MS, 'CONSTANTS.OTP.EXPIRY_MS');
    assertPositiveInteger(CONSTANTS.OTP?.COOL_DOWN_MS, 'CONSTANTS.OTP.COOL_DOWN_MS');
    assertPositiveInteger(CONSTANTS.OTP?.MAX_ATTEMPTS, 'CONSTANTS.OTP.MAX_ATTEMPTS');
    assertPositiveInteger(CONSTANTS.OTP?.BLOCK_TIME_MS, 'CONSTANTS.OTP.BLOCK_TIME_MS');

    // Requirement 3: EXPIRY_MS must always be strictly greater than COOL_DOWN_MS
    if (
        CONSTANTS.OTP?.EXPIRY_MS &&
        CONSTANTS.OTP?.COOL_DOWN_MS &&
        CONSTANTS.OTP.EXPIRY_MS <= CONSTANTS.OTP.COOL_DOWN_MS
    ) {
        errors.push(
            `CONSTANTS.OTP.EXPIRY_MS (${CONSTANTS.OTP.EXPIRY_MS}ms) must be strictly greater than COOL_DOWN_MS (${CONSTANTS.OTP.COOL_DOWN_MS}ms)`
        );
    }

    // 5. Validate Password rules
    assertPositiveInteger(CONSTANTS.PASSWORD?.MIN_LENGTH, 'CONSTANTS.PASSWORD.MIN_LENGTH');

    // 6. Validate QUEUE configuration
    const queue = CONSTANTS.QUEUE;
    if (!queue || typeof queue !== 'object') {
        errors.push('CONSTANTS.QUEUE must be defined as an object');
    } else {
        // Condition 1: DRIVER must be 'custom' or 'bullmq' (cannot be null, undefined, or empty string)
        const allowedDrivers = ['custom', 'bullmq'];
        if (!queue.DRIVER || typeof queue.DRIVER !== 'string' || !allowedDrivers.includes(queue.DRIVER.trim().toLowerCase())) {
            errors.push(`CONSTANTS.QUEUE.DRIVER must be either 'custom' or 'bullmq'; received: ${JSON.stringify(queue.DRIVER)}`);
        }

        // Validate EMAIL_RATE_LIMIT_PER_SEC
        assertPositiveInteger(queue.EMAIL_RATE_LIMIT_PER_SEC, 'CONSTANTS.QUEUE.EMAIL_RATE_LIMIT_PER_SEC');

        // Condition 2: HIGH_PRIORITY_WEIGHT and LOW_PRIORITY_WEIGHT
        // - Cannot be undefined or null
        // - Cannot be greater than EMAIL_RATE_LIMIT_PER_SEC
        // - Their sum cannot be greater than EMAIL_RATE_LIMIT_PER_SEC
        // - Their sum must be > 0 (one of them can be 0, but not both)
        const highWeight = queue.HIGH_PRIORITY_WEIGHT;
        const lowWeight = queue.LOW_PRIORITY_WEIGHT;
        const rateLimit = queue.EMAIL_RATE_LIMIT_PER_SEC;

        const isNonNegativeInteger = (val) => Number.isInteger(val) && val >= 0;

        if (!isNonNegativeInteger(highWeight)) {
            errors.push(`CONSTANTS.QUEUE.HIGH_PRIORITY_WEIGHT must be a non-negative integer (>= 0); received: ${JSON.stringify(highWeight)}`);
        }
        if (!isNonNegativeInteger(lowWeight)) {
            errors.push(`CONSTANTS.QUEUE.LOW_PRIORITY_WEIGHT must be a non-negative integer (>= 0); received: ${JSON.stringify(lowWeight)}`);
        }

        if (isNonNegativeInteger(highWeight) && isNonNegativeInteger(lowWeight) && Number.isInteger(rateLimit)) {
            if (highWeight > rateLimit) {
                errors.push(`CONSTANTS.QUEUE.HIGH_PRIORITY_WEIGHT (${highWeight}) cannot be greater than EMAIL_RATE_LIMIT_PER_SEC (${rateLimit})`);
            }
            if (lowWeight > rateLimit) {
                errors.push(`CONSTANTS.QUEUE.LOW_PRIORITY_WEIGHT (${lowWeight}) cannot be greater than EMAIL_RATE_LIMIT_PER_SEC (${rateLimit})`);
            }
            if (highWeight + lowWeight > rateLimit) {
                errors.push(`The sum of HIGH_PRIORITY_WEIGHT (${highWeight}) and LOW_PRIORITY_WEIGHT (${lowWeight}) [sum: ${highWeight + lowWeight}] cannot exceed EMAIL_RATE_LIMIT_PER_SEC (${rateLimit})`);
            }
            if (highWeight + lowWeight <= 0) {
                errors.push(`The sum of HIGH_PRIORITY_WEIGHT (${highWeight}) and LOW_PRIORITY_WEIGHT (${lowWeight}) must be strictly greater than 0`);
            }
        }

        // Condition 3: MAX_ATTEMPTS
        // - Cannot be null or undefined
        // - Must be >= 1 (strictly greater than 0, non-negative, non-zero)
        if (!Number.isInteger(queue.MAX_ATTEMPTS) || queue.MAX_ATTEMPTS < 1) {
            errors.push(`CONSTANTS.QUEUE.MAX_ATTEMPTS must be an integer >= 1; received: ${JSON.stringify(queue.MAX_ATTEMPTS)}`);
        }
    }

    // If any constant validation error exists, halt server startup immediately
    if (errors.length > 0) {
        logger.fatal(
            { errors },
            'Critical application configuration error: CONSTANTS validation failed. Halting process'
        );
        process.exit(1);
    }

    logger.info('Application constants validated successfully');
};

// Automatically execute validation upon module load
validateEnv();
validateConstants();

export default { validateEnv, validateConstants };
