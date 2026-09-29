import express from 'express';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import { verifyRecaptcha } from '../../../middlewares/recaptcha.middleware.js';
import Controller from '../../../controllers/v1/auth.controller.js';


const router = express.Router();

router.post('/login',
    verifyRecaptcha,
    Controller.login
);

router.post('/register',
    verifyRecaptcha,
    Controller.register
);

router.post('/google',
    Controller.googleAuth
);

router.post('/sendOtp',
    Controller.sendOTP
);

router.post('/verifyOtpForReset',
    Controller.verifyOtpForReset
);

router.post('/resetPassword',
    Controller.resetPassword
);

router.post('/verifyOtp',
    Controller.verifyOTP
);

router.get('/status',
    authenticate,
    Controller.checkAuth
);

router.get('/logout',
    authenticate,
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