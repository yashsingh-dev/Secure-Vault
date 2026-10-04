import './src/config/validateEnv.js';
import http from 'http';
import app from './src/app.js';
import { logger } from './src/lib/logger.js';

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = http.createServer(app);

server.listen(PORT, () => {
    logger.info({ port: PORT, environment: NODE_ENV }, `HTTP server running on port ${PORT} [${NODE_ENV}]`);
});
