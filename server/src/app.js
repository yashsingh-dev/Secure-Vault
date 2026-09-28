import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from "helmet";

import dbConnection from './db/connection.js';
import errorHandler from './middlewares/errorHandler.middleware.js';
import { doubleCsrfProtection, generateCsrfToken } from './middlewares/csrf.middleware.js';
import routes from './routes/index.js';

const app = express();

dbConnection();
app.use(helmet());
app.use(cors({
    origin: [process.env.CLIENT_URL_DEV],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Cookie', 'x-csrf-token', 'X-CSRF-Token', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));
app.use(cookieParser());
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`Incoming Request: ${req.method} ${req.originalUrl}`);
        console.log('Request Body:', req.body);
    }
    next();
});

// Health check or status route
app.get('/api/health', (req, res) => {
    res.send('API is running...');
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