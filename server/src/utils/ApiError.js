class ApiError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApiError);
        }
    }
}

export default ApiError;