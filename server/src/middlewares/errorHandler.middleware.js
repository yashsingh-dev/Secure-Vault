import response from '../utils/response.utils.js'

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token Expired';
    }
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid Token';
    }

    console.log(`[${statusCode}] Global Error: ${message}`, err.stack);

    return response(res, statusCode, message, null, false);
}

export default errorHandler;
