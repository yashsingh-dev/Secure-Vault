import mongoose from 'mongoose';
import { setAuthTokens, clearTokenCookies, getAccessToken, getRefreshToken } from '../../utils/setCookies.utils.js';
import { generateAccessToken, generateRefreshToken, generateResetToken } from '../../utils/setJwtToken.utils.js';
import ApiError from '../../utils/ApiError.js';
import response from '../../utils/response.utils.js';
import { CONSTANTS } from '../../config/constants.js';
import authService from '../../services/v1/auth.service.js';
import userService from '../../services/v1/user.service.js';
import { parseClientMeta } from '../../utils/device.utils.js';
import userModel from '../../models/user.model.js';
import asyncHandler from '../../utils/asyncHandler.utils.js';
import { safeRedis } from '../../db/redis.js';
import REDIS_KEYS from '../../config/redisKeys.js';


const login = asyncHandler(async (req, res) => {
    const { email, password, rememberMe } = req.body;

    const { user, is2FAEnabled } = await authService.login(email, password);

    if (!is2FAEnabled) {
        // Generate JWT Token
        const familyId = new mongoose.Types.ObjectId();
        const clientMeta = parseClientMeta(req);

        // Generate tokens in parallel
        const [accessToken, refreshToken] = await Promise.all([
            generateAccessToken(user._id, user.tokenVersion, familyId),
            generateRefreshToken(user._id, rememberMe, clientMeta, familyId)
        ]);

        // Set Cookie
        setAuthTokens(res, CONSTANTS.NAME.ACCESS_TOKEN, accessToken, CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS);
        setAuthTokens(res, CONSTANTS.NAME.REFRESH_TOKEN, refreshToken, rememberMe ? CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS : CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS);
    }

    // Send Response
    return response(res, 200, 'Signed in successfully.', {
        id: user._id,
        email: user.email,
        is2FAEnabled
    });
});

const register = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const { user } = await authService.register(name, email, password);

    // Send Response
    return response(res, 201, 'Account registered successfully.', {
        id: user._id,
        email: user.email,
        is2FAEnabled: true
    });
});

const googleAuth = asyncHandler(async (req, res) => {
    const { code } = req.body;

    const { user, is2FAEnabled, rememberMe = false } = await authService.googleAuth(code);

    if (!is2FAEnabled) {
        // Generate JWT Token
        const familyId = new mongoose.Types.ObjectId();
        const clientMeta = parseClientMeta(req);

        const [accessToken, refreshToken] = await Promise.all([
            generateAccessToken(user._id, user.tokenVersion, familyId),
            generateRefreshToken(user._id, rememberMe, clientMeta, familyId)
        ]);

        // Set Cookie
        setAuthTokens(res, CONSTANTS.NAME.ACCESS_TOKEN, accessToken, CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS);
        setAuthTokens(res, CONSTANTS.NAME.REFRESH_TOKEN, refreshToken, rememberMe ? CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS : CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS);
    }

    // Send Response
    return response(res, 200, 'Successfully signed in with Google.', {
        id: user._id,
        email: user.email,
        is2FAEnabled
    });
});

const resetPassword = asyncHandler(async (req, res) => {
    const { email, password, token } = req.body;

    const { user } = await authService.resetPassword(email, password, token);

    // Send Response
    return response(res, 200, 'Your password has been reset successfully.', {
        id: user._id,
        email: user.email
    });
});

const sendOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const { user } = await authService.sendOTP(email);

    // Send Response
    return response(res, 200, 'Verification code sent to your email.', {
        id: user._id,
        email: user.email
    });
});

const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otp, rememberMe } = req.body;

    const { user } = await authService.verifyOTP(email, otp);

    // Generate JWT Token
    const familyId = new mongoose.Types.ObjectId();
    const clientMeta = parseClientMeta(req);

    const [accessToken, refreshToken] = await Promise.all([
        generateAccessToken(user._id, user.tokenVersion, familyId),
        generateRefreshToken(user._id, rememberMe, clientMeta, familyId)
    ]);

    // Set Cookie
    setAuthTokens(res, CONSTANTS.NAME.ACCESS_TOKEN, accessToken, CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS);
    setAuthTokens(res, CONSTANTS.NAME.REFRESH_TOKEN, refreshToken, rememberMe ? CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS : CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS);

    // Send Response
    return response(res, 200, 'Verification code verified successfully.', {
        id: user._id,
        email: user.email
    });
});

const verifyOtpForReset = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    const { user } = await authService.verifyOTP(email, otp);

    // Generate Reset Token
    const token = await generateResetToken(user._id);
    const resetTokenExpiry = new Date(Date.now() + CONSTANTS.RESET_TOKEN.EXPIRY_MS);

    await Promise.all([
        userModel.updateOne(
            { _id: user._id },
            { $set: { resetToken: token, resetTokenExpiry } }
        ),

        // Warm up Redis cache for emailToId
        safeRedis.set(REDIS_KEYS.emailToId(email), user._id.toString(), CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000)
    ]);

    // Send Response
    return response(res, 200, 'Verification code verified successfully.', {
        id: user._id,
        email: user.email,
        token
    });
});

const checkAuth = asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ApiError(401, 'Unauthorized access. Please sign in to continue.');
    }

    const profile = await userService.getProfile(req.user);

    // Send Response
    return response(res, 200, 'Session authenticated.', profile);
});

const logout = asyncHandler(async (req, res) => {
    const accessToken = getAccessToken(req);
    const refreshToken = getRefreshToken(req);

    // Perform best-effort cleanup in database
    if (accessToken || refreshToken) {
        await authService.logout(accessToken, refreshToken);
    }

    // Always Clear Cookies and return success
    clearTokenCookies(res);
    return response(res, 200, 'Signed out successfully.');
});

const logoutAll = asyncHandler(async (req, res) => {
    const accessToken = getAccessToken(req);
    const refreshToken = getRefreshToken(req);
    
    const userId = req.user;
    const currentTokenVersion = req.tokenVersion;

    try {
        await authService.logoutAll(accessToken, refreshToken, userId, currentTokenVersion);
    } finally {
        clearTokenCookies(res);
    }

    // Send Response
    return response(res, 200, 'Signed out from all devices successfully.');
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const oldRefreshToken = getRefreshToken(req);

    // Check if refresh token exists in cookie
    if (!oldRefreshToken || oldRefreshToken === 'undefined') {
        clearTokenCookies(res);
        throw new ApiError(401, 'Session expired or invalid. Please sign in again.');
    }

    try {
        const { user, rememberMe, isGracePeriod = false, familyId } = await authService.refreshToken(oldRefreshToken);

        if (!isGracePeriod) {
            // Parse Client Meta
            const clientMeta = parseClientMeta(req);

            // Generate new access and refresh token
            const [newAccessToken, newRefreshToken] = await Promise.all([
                generateAccessToken(user._id, user.tokenVersion, familyId),
                generateRefreshToken(user._id, rememberMe, clientMeta, familyId)
            ]);

            // Set Cookie
            setAuthTokens(res, CONSTANTS.NAME.ACCESS_TOKEN, newAccessToken, CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS);
            setAuthTokens(res, CONSTANTS.NAME.REFRESH_TOKEN, newRefreshToken, rememberMe ? CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS : CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS);
        }

        // Send Response (Grace period requests return 201 so frontend interceptor proceeds with already-set cookies)
        return response(res, 201, 'Session renewed successfully.');
    } catch (error) {
        clearTokenCookies(res);
        throw error;
    }
});

const getSessions = asyncHandler(async (req, res) => {
    const currentRefreshToken = getRefreshToken(req);
    const sessions = await authService.getSessions(req.user, currentRefreshToken);

    return response(res, 200, 'Active sessions retrieved successfully.', {
        sessions,
        total: sessions.length
    });
});

const revokeSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId) {
        throw new ApiError(400, 'Session ID is required.');
    }

    const currentAccessToken = getAccessToken(req);
    const currentRefreshToken = getRefreshToken(req);
    const { isCurrent } = await authService.revokeSession(req.user, sessionId, currentAccessToken, currentRefreshToken);

    if (isCurrent) {
        clearTokenCookies(res);
    }

    return response(res, 200, isCurrent ? 'Current session revoked successfully.' : 'Session revoked successfully.', {
        isCurrent
    });
});


export default {
    login,
    register,
    googleAuth,
    logout,
    logoutAll,
    checkAuth,
    sendOTP,
    verifyOtpForReset,
    resetPassword,
    verifyOTP,
    refreshAccessToken,
    getSessions,
    revokeSession
};