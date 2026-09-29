import 'dotenv/config';

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
    { key: 'CSRF_SECRET', default: 'default-key' }
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
        console.warn('\n⚠️  [ENV WARNING] The following optional environment variables are not set:');
        for (const item of missingOptional) {
            console.warn(`   • ${item.key}: using default "${item.default}"`);
        }
        console.warn('   (For production security, please configure dedicated values in your .env)\n');
    }

    // If required keys are missing, halt startup
    if (missingRequired.length > 0) {
        console.error('\n' + '='.repeat(70));
        console.error('❌ [ENV ERROR] CRITICAL: MISSING REQUIRED ENVIRONMENT VARIABLES');
        console.error('='.repeat(70));
        console.error('The server cannot start because the following required keys are missing in .env:');
        for (const key of missingRequired) {
            console.error(`   ✗ ${key}`);
        }
        console.error('\nPlease define these required variables in your server/.env file.');
        console.error('='.repeat(70) + '\n');
        process.exit(1);
    }

    console.log('✅ Environment configuration validated successfully.');
};

// Automatically execute validation upon module load
validateEnv();

export default validateEnv;
