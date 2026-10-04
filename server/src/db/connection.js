import mongoose from 'mongoose';
import { logger } from '../lib/logger.js';

const MONGO_OPTIONS = {
    maxPoolSize: 50, // Keep up to 50 socket connections open for high concurrent throughput
    minPoolSize: 10, // Maintain a pool of 10 warm connections to eliminate handshake latency on traffic spikes
    serverSelectionTimeoutMS: 7000, // Fail fast after 7 seconds if MongoDB is unreachable
    socketTimeoutMS: 45000, // Close idle sockets after 45 seconds of inactivity
    autoIndex: process.env.NODE_ENV !== 'production' // Skip building indexes on boot in production to avoid startup blocking
};

async function dbConnection() {
    try {
        const mongo = await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);
        logger.info({ host: mongo.connection.host }, 'MongoDB connection established successfully');
    } catch (error) {
        logger.fatal({ err: error.message }, 'Failed to establish MongoDB connection. Terminating process');
        process.exit(1);
    }
}

export default dbConnection;