import response from '../utils/response.utils.js'

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'An unexpected error occurred. Please try again later.';

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Your session has expired. Please sign in again.';
    }
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid session token. Please sign in again.';
    }
    else if (err.code === 'EBADCSRFTOKEN' || err.message === 'Invalid or missing CSRF token') {
        statusCode = 403;
        message = 'Invalid or missing CSRF token. Please refresh the page and try again.';
    }

    console.log(`[${statusCode}] Global Error: ${message}`);

    return response(res, statusCode, message, null, false);
}

export default errorHandler;
