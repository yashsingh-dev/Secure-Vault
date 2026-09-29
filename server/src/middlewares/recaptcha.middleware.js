import ApiError from '../utils/ApiError.js';
import { verifyRecaptchaToken } from '../services/v1/recaptcha.service.js';

/**
 * Express middleware to verify Google reCAPTCHA v2 token before proceeding
 * Validates token presence, calls Google's siteverify API, and checks success & expiration
 */
export const verifyRecaptcha = async (req, res, next) => {
    try {
        const token =
            req.body?.recaptchaToken ||
            req.body?.['g-recaptcha-response'] ||
            req.headers?.['x-recaptcha-token'];

        if (!token || (typeof token === 'string' && !token.trim())) {
            throw new ApiError(400, 'reCAPTCHA verification is required. Please check the "I\'m not a robot" box.');
        }

        const clientIp =
            req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.socket?.remoteAddress ||
            req.ip;

        const verificationResult = await verifyRecaptchaToken(token, clientIp);

        // Attach verification result for any downstream handlers
        req.recaptcha = verificationResult;

        next();
    } catch (error) {
        next(error);
    }
};

export default verifyRecaptcha;
