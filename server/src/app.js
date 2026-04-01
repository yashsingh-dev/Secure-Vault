import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import dbConnection from './db/connection.js';
import errorHandler from './middlewares/errorHandler.js';
import routes from './routes/index.js';

const app = express();

dbConnection();
app.use(cors({
    origin: [process.env.CLIENT_URL_DEV, 'http://localhost:5173'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Cookie'],
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

app.use(routes);
app.use(errorHandler);



export default app;