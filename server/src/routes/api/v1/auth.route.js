import express from 'express';
const router = express.Router();
import { authenticate } from '../../../middlewares/auth.middleware.js';
import Controller from '../../../controllers/v1/auth.controller.js';


router.post('/login',
    Controller.login
);

router.post('/register',
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

router.get('/tokenRefresh',
    Controller.refreshAccessToken
);


export default router;