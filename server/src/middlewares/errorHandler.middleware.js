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
    else if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyValue || {})[0] || 'resource';
        message = `An account with this ${field} already exists. Please sign in instead.`;
    }
    else if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid format for '${err.path}'.`;
    }
    else if (err.name === 'ValidationError') {
        statusCode = 400;
        const firstError = Object.values(err.errors || {})[0];
        message = firstError?.message || 'Invalid input data.';
    }
    else if (err.name === 'ZodError') {
        statusCode = 400;
        message = err.issues?.[0]?.message || 'Validation failed.';
    }

    console.log(`[${statusCode}] Global Error: ${message}`);

    return response(res, statusCode, message);
}

export default errorHandler;
