import express from 'express';
import apiV1Routes from './api/v1/index.js';
import apiV2Routes from './api/v2/index.js';

const router = express.Router();

router.use('/api/v1', apiV1Routes);
router.use('/api/v2', apiV2Routes);
router.use('/v2', apiV2Routes);

export default router;
