import crypto from 'node:crypto';
import pinoHttp from 'pino-http';
import { logger } from '../lib/logger.js';

export const httpLogger = pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),

    // Production standard: Auto-log when a request finishes (status, duration, method)
    autoLogging: {
        // Prevent frequent health-check pings from polluting logs
        ignore: (req) => req.url === '/api/health' || req.url === '/health',
    },

    // 1. Log immediately when request arrives
    customReceivedMessage: (req) => {
        return `--> Incoming: ${req.method} ${req.originalUrl || req.url}`;
    },

    // 2. Log when request completes
    customSuccessMessage: (req, res, responseTime) => {
        return `<-- Completed: ${req.method} ${req.originalUrl || req.url} ${res.statusCode} (${responseTime}ms)`;
    },

    customErrorMessage: (req, res, err) => {
        return `<-- Failed: ${req.method} ${req.originalUrl || req.url} ${res.statusCode}: ${err.message}`;
    },

    // Automatically elevate log severity based on HTTP status code
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },

    // Keep logs concise: avoid dumping 50+ lines of raw headers to the terminal
    serializers: {
        req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            query: req.query,
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
    },
});

export default httpLogger;
