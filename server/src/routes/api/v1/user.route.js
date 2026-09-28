import express from 'express';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import userController from '../../../controllers/v1/user.controller.js';

const router = express.Router();

router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.patch('/profile', authenticate, userController.updateProfile);

export default router;
