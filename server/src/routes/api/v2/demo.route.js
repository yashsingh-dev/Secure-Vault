import express from 'express';
import demoController from '../../../controllers/v2/demo.controller.js';

const router = express.Router();

// Public routes (No authentication or CSRF required)
router.get('/users', demoController.getUsers);
router.get('/todos', demoController.getTodos);

export default router;
