import ApiError from '../utils/ApiError.js';

export const validate = (schema, source = 'body') => (req, res, next) => {
    const dataToValidate = req[source];
    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
        const message = result.error.issues?.[0]?.message || 'Invalid input data.';
        return next(new ApiError(400, message));
    }

    // Set sanitized/parsed data (e.g. schema defaults like rememberMe: false)
    req[source] = result.data;
    next();
};

export default validate;
