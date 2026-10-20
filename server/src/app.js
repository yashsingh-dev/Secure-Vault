import express from 'express';
import './config/validateSetup.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from "helmet";
import httpLogger from './middlewares/httpLogger.middleware.js';

import dbConnection from './db/connection.js';
import errorHandler from './middlewares/errorHandler.middleware.js';
import { doubleCsrfProtection, generateCsrfToken } from './middlewares/csrf.middleware.js';
import { globalLimiter } from './config/rateLimiters.js';
import routes from './routes/index.js';

const app = express();

dbConnection();

app.use(helmet());
app.use(cors({
    origin: [process.env.CLIENT_URL_DEV || 'http://localhost:5173'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Cookie', 'x-csrf-token', 'X-CSRF-Token', 'Authorization', 'x-recaptcha-token', 'X-Recaptcha-Token'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));
app.use(cookieParser());
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(httpLogger);

// Health check & Root Ping (Must be BEFORE rate limiting)
app.get(['/', '/api/health'], (req, res) => {
    return res.status(200).send('OK');
});
app.head(['/', '/api/health'], (req, res) => {
    return res.status(200).end();
});

// Global Rate Limiter (Only for actual application routes)
app.use(globalLimiter);

// Sentry error test route
app.get("/api/debug-sentry", function mainHandler(req, res) {
    throw new Error("My first Sentry error!");
});

// CSRF Token Generation Route
app.get(['/api/csrf-token', '/api/v1/csrf-token'], (req, res) => {
    const csrfToken = generateCsrfToken(req, res);
    return res.status(200).json({ csrfToken });
});

// Protect all state-changing routes (POST, PUT, DELETE, PATCH)
app.use(doubleCsrfProtection);

app.use(routes);
app.use(errorHandler);

export default app;