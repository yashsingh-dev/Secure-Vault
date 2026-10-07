import express from 'express';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import { verifyRecaptcha } from '../../../middlewares/recaptcha.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import schemas from '../../../lib/schemas.js';
import Controller from '../../../controllers/v1/auth.controller.js';
import {
    loginBurstLimiter,
    loginSustainedLimiter,
    registerLimiter,
    otpLimiter,
    refreshLimiter
} from '../../../config/rateLimiters.js';

const router = express.Router();

router.post('/login',
    loginBurstLimiter,      // Tier 1: Max 5 reqs per 1 min
    loginSustainedLimiter,  // Tier 2: Max 10 reqs per 5 mins
    verifyRecaptcha,
    validate(schemas.loginSchema),
    Controller.login
);

router.post('/register',
    registerLimiter,        // Max 5 registrations per 1 hour
    verifyRecaptcha,
    validate(schemas.registerSchema),
    Controller.register
);

router.post('/google',
    loginBurstLimiter,
    validate(schemas.googleAuthSchema),
    Controller.googleAuth
);

router.post('/sendOtp',
    otpLimiter,             // Max 3 requests per 15 mins per email
    validate(schemas.sendOtpSchema),
    Controller.sendOTP
);

router.post('/verifyOtpForReset',
    otpLimiter,
    validate(schemas.otpForResetSchema),
    Controller.verifyOtpForReset
);

router.post('/resetPassword',
    otpLimiter,
    validate(schemas.resetPasswordSchema),
    Controller.resetPassword
);

router.post('/verifyOtp',
    loginBurstLimiter,
    validate(schemas.otpSchema),
    Controller.verifyOTP
);

router.get('/status',
    authenticate,
    Controller.checkAuth
);

router.get('/sessions',
    authenticate,
    Controller.getSessions
);

router.delete('/sessions/:sessionId',
    authenticate,
    Controller.revokeSession
);

router.get('/logout',
    Controller.logout
);

router.get('/logoutAll',
    authenticate,
    Controller.logoutAll
);

router.get(['/tokenRefresh', '/token-refresh'],
    refreshLimiter,
    Controller.refreshAccessToken
);


export default router;