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
    RateLimit.loginBurstLimiter,      
    RateLimit.loginSustainedLimiter, 
    Recaptcha.verify,
    Validate.body(schemas.loginSchema),
    Controller.login
);

router.post('/register',
    RateLimit.registerLimiter,       
    Recaptcha.verify,
    Validate.body(schemas.registerSchema),
    Controller.register
);

router.post('/google',
    RateLimit.googleAuthLimiter,
    Validate.body(schemas.googleAuthSchema),
    Controller.googleAuth
);

router.post('/sendOtp',
    RateLimit.otpSendLimiter,         
    Validate.body(schemas.sendOtpSchema),
    Controller.sendOTP
);

router.post('/verifyOtpForReset',
    RateLimit.otpVerifyLimiter,       
    Validate.body(schemas.otpForResetSchema),
    Controller.verifyOtpForReset
);

router.post('/resetPassword',
    RateLimit.passwordResetLimiter,   
    Validate.body(schemas.resetPasswordSchema),
    Controller.resetPassword
);

router.post('/verifyOtp',
    RateLimit.otpVerifyLimiter,       
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