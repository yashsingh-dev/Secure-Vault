import { doubleCsrf } from 'csrf-csrf';

export const {
    invalidCsrfTokenError,
    generateCsrfToken,
    validateRequest,
    doubleCsrfProtection
} = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET || 'secure-vault-default-csrf-secret-key-32chars',
    getSessionIdentifier: (req) => {
        const userId = req?.user ? req.user.toString() : '';
        console.log("User Id:", userId)
        return userId;
    },
    cookieName: '__Host-ps-csrf',
    cookieOptions: {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        path: '/'
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
    errorConfig: {
        statusCode: 403,
        message: 'Invalid or missing CSRF token',
        code: 'EBADCSRFTOKEN'
    }
});