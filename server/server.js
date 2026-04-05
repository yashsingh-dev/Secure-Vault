import http from 'http';
import app from './src/app.js';

const PORT = process.env.PORT || 3000;
console.log('NODE_ENV', process.env.NODE_ENV);

const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
