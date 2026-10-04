import 'dotenv/config';
import { logger } from '../lib/logger.js';

/**
 * Required Environment Keys
 * Server startup will immediately halt if any of these are missing.
 */
const REQUIRED_KEYS = [
    'MONGO_URI',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'OAUTH_GOOGLE_CLIENT_ID',
    'OAUTH_GOOGLE_SECRET',
    'RECAPTCHA_SECRET_KEY'
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
    { key: 'CSRF_SECRET', default: 'default-key' },
    { key: 'REDIS_URL', default: 'redis://127.0.0.1:6379' }
];

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

// Automatically execute validation upon module load
validateEnv();

export default validateEnv;
