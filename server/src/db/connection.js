import mongoose from 'mongoose';

async function dbConnection() {
    try {
        const mongo = await mongoose.connect(process.env.MONGO_URI);
        console.log('Database Connected: ', mongo.connection.host);
    } catch (error) {
        console.log('Error in database connection: ', error.message);
        process.exit(1);
    }
}

export default dbConnection;