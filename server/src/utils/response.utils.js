const response = (res, statusCode = 200, message = null, payload = null) => {
    // 2xx and 3xx are successes; 4xx and 5xx are errors (DRY: auto-derived from HTTP status)
    const success = statusCode >= 200 && statusCode < 400;
    
    // Fallback default message if none is provided
    const defaultMessage = success ? 'Success' : 'Internal Server Error';

    return res.status(statusCode).json({
        success,
        message: message || defaultMessage,
        payload, // keeping 'payload' for client compatibility (can alias to 'data' if needed)
    });
};

export default response;
