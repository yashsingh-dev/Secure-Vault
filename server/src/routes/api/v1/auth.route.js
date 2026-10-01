import express from 'express';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import { verifyRecaptcha } from '../../../middlewares/recaptcha.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import schemas from '../../../lib/schemas.js';
import Controller from '../../../controllers/v1/auth.controller.js';


const router = express.Router();

router.post('/login',
    verifyRecaptcha,
    validate(schemas.loginSchema),
    Controller.login
);

router.post('/register',
    verifyRecaptcha,
    validate(schemas.registerSchema),
    Controller.register
);

router.post('/google',
    validate(schemas.googleAuthSchema),
    Controller.googleAuth
);

router.post('/sendOtp',
    validate(schemas.sendOtpSchema),
    Controller.sendOTP
);

router.post('/verifyOtpForReset',
    validate(schemas.otpForResetSchema),
    Controller.verifyOtpForReset
);

router.post('/resetPassword',
    validate(schemas.resetPasswordSchema),
    Controller.resetPassword
);

router.post('/verifyOtp',
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
    Controller.refreshAccessToken
);


export default router;