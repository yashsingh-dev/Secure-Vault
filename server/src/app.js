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
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`Incoming Request: ${req.method} ${req.originalUrl}`);
    console.log('Request Body:', req.body);
    next();
});

// Health check or status route
app.get('/api/health', (req, res) => {
    res.send('API is running...');
});

app.use(routes);
app.use(errorHandler);



export default app;