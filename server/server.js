import 'dotenv/config';
import './src/config/validateSetup.js';
import http from 'http';
import app from './src/app.js';
import { logger } from './src/lib/logger.js';
import queueService from './src/services/queue/index.js';

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = http.createServer(app);

server.listen(PORT, () => {
    logger.info({ port: PORT, environment: NODE_ENV }, `HTTP server running on port ${PORT} [${NODE_ENV}]`);
    queueService.startWorker();
});

// Graceful shutdown handling
const shutdown = () => {
    logger.info('Shutting down server and queue workers...');
    queueService.stopWorker();
    server.close(() => {
        process.exit(0);
    });
};

process.on('SIGINT', shutdown); // Signal Interrupt
process.on('SIGTERM', shutdown); // Signal Terminate
