const response = (res, statusCode = 500, message = null, payload = null, success = null) => {
    // Determine success if not provided (2xx and 3xx are success)
    const isSuccess = success !== null ? success : (statusCode >= 200 && statusCode < 400);
    
    // Determine message if not provided
    const defaultMessage = isSuccess ? 'Success' : 'Internal Server Error';

    return res.status(statusCode).json({
        success: isSuccess,
        message: message || defaultMessage,
        payload: payload,
    });
};

export default response;
