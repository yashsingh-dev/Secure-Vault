import express from 'express';
import demoRoutes from './demo.route.js';

const router = express.Router();

// Mount demo routes directly so /api/v2/users and /api/v2/todos work
router.use('/demo', demoRoutes);

export default router;
