import express from 'express';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import { verifyRecaptcha } from '../../../middlewares/recaptcha.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import schemas from '../../../lib/schemas.js';
import Controller from '../../../controllers/v1/auth.controller.js';
import RateLimit from '../../../config/rateLimiters.js';

// Namespaced middleware aliases for high readability in route chains
const Auth = { authenticate };
const Recaptcha = { verify: verifyRecaptcha };
const Validate = { body: validate };

const router = express.Router();

router.post('/login',
    RateLimit.loginBurstLimiter,      // Tier 1: Max 5 reqs per 1 min
    RateLimit.loginSustainedLimiter,  // Tier 2: Max 10 reqs per 5 mins
    // Recaptcha.verify,
    Validate.body(schemas.loginSchema),
    Controller.login
);

router.post('/register',
    RateLimit.registerLimiter,        // Max 5 registrations per 1 hour
    // Recaptcha.verify,
    Validate.body(schemas.registerSchema),
    Controller.register
);

router.post('/google',
    RateLimit.googleAuthLimiter,
    Validate.body(schemas.googleAuthSchema),
    Controller.googleAuth
);

router.post('/sendOtp',
    RateLimit.otpSendLimiter,         // Max 3 requests per 15 mins per email
    Validate.body(schemas.sendOtpSchema),
    Controller.sendOTP
);

router.post('/verifyOtpForReset',
    RateLimit.otpVerifyLimiter,       // Max 5 attempts per 15 mins per email
    Validate.body(schemas.otpForResetSchema),
    Controller.verifyOtpForReset
);

router.post('/resetPassword',
    RateLimit.passwordResetLimiter,   // Max 3 password reset submissions per 1 hour
    Validate.body(schemas.resetPasswordSchema),
    Controller.resetPassword
);

router.post('/verifyOtp',
    RateLimit.otpVerifyLimiter,       // Max 5 attempts per 15 mins per email
    Validate.body(schemas.otpSchema),
    Controller.verifyOTP
);

router.get('/status',
    Auth.authenticate,
    Controller.checkAuth
);

router.get('/sessions',
    Auth.authenticate,
    Controller.getSessions
);

router.delete('/sessions/:sessionId',
    Auth.authenticate,
    Controller.revokeSession
);

router.get('/logout',
    Controller.logout
);

router.get('/logoutAll',
    Auth.authenticate,
    Controller.logoutAll
);

router.get(['/tokenRefresh', '/token-refresh'],
    RateLimit.refreshLimiter,
    Controller.refreshAccessToken
);


export default router;