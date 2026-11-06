import express from 'express';
import demoRoutes from './demo.route.js';

const router = express.Router();

// Mount public demo routes at root of v2
router.use('/demo', demoRoutes);

export default router;
