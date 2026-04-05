import express from 'express';
const router = express.Router();
import { authenticate } from '../../middlewares/auth.middleware.js';
import Controller from '../../controllers/auth.controller.js';


router.post('/login',
    Controller.login
);

router.post('/register',
    Controller.register
);

router.post('/send-otp',
    Controller.sendOTP
);

router.post('/verify-otp',
    Controller.verifyOTP
);

// router.get('/logout',
//     authenticate,
//     Controller.logout
// );

// router.get('/logoutAll',
//     authenticate,
//     Controller.logoutAll
// );

// router.get('/token-refresh',
//     Controller.refreshAccessToken
// );


export default router;