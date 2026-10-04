import ApiError from '../../utils/ApiError.js';
import { logger } from '../../lib/logger.js';

const GOOGLE_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
// Google reCAPTCHA v2 tokens expire after 2 minutes (120 seconds)
const MAX_TOKEN_AGE_MS = 2 * 60 * 1000;

/**
 * Maps Google reCAPTCHA error codes to human-readable error messages and HTTP status codes
 * @param {string[]} errorCodes - Array of error codes returned by Google's siteverify API
 * @returns {{ statusCode: number, message: string }}
 */
const mapRecaptchaError = (errorCodes = []) => {
    if (errorCodes.includes('timeout-or-duplicate')) {
        return {
            statusCode: 400,
            message: 'reCAPTCHA verification has expired or was already used. Please complete the checkbox again.'
        };
    }
    if (errorCodes.includes('invalid-input-response')) {
        return {
            statusCode: 403,
            message: 'Invalid reCAPTCHA token. Please solve the checkbox again.'
        };
    }
    if (errorCodes.includes('missing-input-response')) {
        return {
            statusCode: 400,
            message: 'reCAPTCHA response token is missing. Please complete the "I\'m not a robot" checkbox.'
        };
    }
    if (errorCodes.includes('invalid-input-secret') || errorCodes.includes('missing-input-secret')) {
        logger.error({ errorCodes }, 'Google reCAPTCHA secret configuration error: invalid or missing secret key');
        return {
            statusCode: 500,
            message: 'Server security configuration error. Please contact the administrator.'
        };
    }
    return {
        statusCode: 403,
        message: 'reCAPTCHA verification failed. Please try again.'
    };
};

/**
 * Verifies a Google reCAPTCHA v2 token with Google's siteverify API
 * @param {string} token - The client response token from reCAPTCHA widget
 * @param {string} [remoteIp] - Optional remote IP address of the client
 * @returns {Promise<{ success: boolean, challenge_ts?: string, hostname?: string }>}
 */
export const verifyRecaptchaToken = async (token, remoteIp) => {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
        logger.fatal('Critical configuration failure: RECAPTCHA_SECRET_KEY is undefined in environment variables');
        throw new ApiError(500, 'reCAPTCHA service is not configured on the server.');
    }

    if (!token || typeof token !== 'string' || !token.trim()) {
        throw new ApiError(400, 'reCAPTCHA verification is required. Please check the "I\'m not a robot" box.');
    }

    const body = new URLSearchParams({
        secret: secretKey,
        response: token.trim()
    });

    if (remoteIp) {
        body.append('remoteip', remoteIp);
    }

    const response = await fetch(GOOGLE_VERIFY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
    });

    if (!response.ok) {
        throw new ApiError(502, `Unable to reach reCAPTCHA verification service (HTTP ${response.status}).`);
    }

    const data = await response.json();

    // 1. Validate success === true
    if (!data.success) {
        const errorCodes = data['error-codes'] || [];
        const { statusCode, message } = mapRecaptchaError(errorCodes);
        throw new ApiError(statusCode, message);
    }

    // 2. Validate token is not expired via challenge_ts (with slight tolerance for clock skew)
    if (data.challenge_ts) {
        const challengeTime = new Date(data.challenge_ts).getTime();
        const now = Date.now();
        // Google tokens expire in 2 minutes; allow 3 minutes to accommodate network latency/clock skew
        const TOLERANCE_MS = 3 * 60 * 1000;
        if (now - challengeTime > TOLERANCE_MS) {
            throw new ApiError(400, 'reCAPTCHA verification token has expired. Please verify again.');
        }
    }

    return data;
};

export default {
    verifyRecaptchaToken
};
