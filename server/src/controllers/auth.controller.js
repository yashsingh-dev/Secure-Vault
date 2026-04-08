import { setAuthTokens, clearToken, clearTokenCookies } from '../utils/setCookies.utils.js'
import { generateAccessToken, generateRefreshToken } from '../utils/setJwtToken.utils.js';
import jwt from 'jsonwebtoken';
import userModel from '../models/user.model.js';
import refreshTokenModel from '../models/refreshToken.model.js';
import ApiError from '../utils/ApiError.js';
import response from '../utils/response.utils.js';
import { CONSTANTS } from '../config/constants.js';
import secureHash from '../utils/crypto.utils.js';
import authService from '../services/auth.service.js';
import { emailSchema, googleCodeSchema, loginSchema, otpCodeSchema, otpSchema, registerSchema } from '../lib/schemas.js';


const login = async (req, res, next) => {
    try {
        const { email, password, rememberMe = false } = req.body;

        if (!email || !password) {
            throw new ApiError(400, 'Email and password are required');
        }

        // Validate Input
        const { success, error } = loginSchema.safeParse(req.body);
        if (!success) {
            throw new ApiError(400, error.errors[0].message);
        }

        const { user, is2FAEnabled } = await authService.login(email, password);

        // Generate JWT Token
        const accessToken = await generateAccessToken(user._id);
        const refreshToken = await generateRefreshToken(user._id, rememberMe);

        // Set Cookie
        await setAuthTokens(res, 'accessToken', accessToken, CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS);
        await setAuthTokens(res, 'refreshToken', refreshToken, rememberMe ? CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS : CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS);

        // Send Response
        return response(res, 200, 'Login successful', {
            id: user._id,
            email: user.email,
            is2FAEnabled
        });
    }
    catch (error) {
        next(error);
    }
}

const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            throw new ApiError(400, 'Name, email, password are required');
        }

        // Validate Input
        const { success, error } = registerSchema.safeParse(req.body);
        if (!success) {
            throw new ApiError(400, error.errors[0].message);
        }

        const { user } = await authService.register(name, email, password);

        // Send Response
        return response(res, 201, 'Registered successfully', {
            id: user._id,
            email: user.email,
            is2FAEnabled: true
        });
    }
    catch (error) {
        next(error);
    }
}

const googleAuth = async (req, res, next) => {
    try {
        const { code } = req.body;

        if (!code) {
            throw new ApiError(400, 'Code is required');
        }

        const { user, is2FAEnabled, rememberMe } = await authService.googleAuth(code);

        // Generate JWT Token
        const accessToken = await generateAccessToken(user._id);
        const refreshToken = await generateRefreshToken(user._id, rememberMe);

        // Set Cookie
        await setAuthTokens(res, 'accessToken', accessToken, CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS);
        await setAuthTokens(res, 'refreshToken', refreshToken, rememberMe ? CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS : CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS);

        // Send Response
        return response(res, 200, 'Google login successful', {
            id: user._id,
            email: user.email,
            is2FAEnabled
        });
    }
    catch (error) {
        next(error);
    }
}

const sendOTP = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            throw new ApiError(400, 'Email is required');
        }

        // Validate Input
        const { success, error } = emailSchema.safeParse({ email });
        if (!success) {
            throw new ApiError(400, error.errors[0].message);
        }

        const { user } = await authService.sendOTP(email);

        // Send Response
        return response(res, 200, 'OTP sent successfully', {
            id: user._id,
            email: user.email
        });
    }
    catch (error) {
        next(error);
    }
}

const verifyOTP = async (req, res, next) => {
    try {
        const { email, otp, rememberMe = false } = req.body;

        if (!email || !otp) {
            throw new ApiError(400, 'Email, otp are required');
        }

        // Validate Input
        const { success, error } = otpSchema.safeParse({ email, otp, rememberMe });
        if (!success) {
            throw new ApiError(400, error.errors[0].message);
        }

        const { user } = await authService.verifyOTP(email, otp);

        // Generate JWT Token
        const accessToken = await generateAccessToken(user._id);
        const refreshToken = await generateRefreshToken(user._id, rememberMe);

        // Set Cookie
        await setAuthTokens(res, 'accessToken', accessToken, CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS);
        await setAuthTokens(res, 'refreshToken', refreshToken, rememberMe ? CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS : CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS);

        // Send Response
        return response(res, 201, 'OTP Verified successfully', {
            id: user._id,
            email: user.email
        });
    }
    catch (error) {
        next(error);
    }
}

const checkAuth = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }

        // Send Response
        return response(res, 200, 'Authorized', {
            id: req.user,
        });
    }
    catch (error) {
        next(error);
    }
}

const logout = async (req, res, next) => {
    try {
        const accessToken = req.cookies.accessToken;
        const refreshToken = req.cookies.refreshToken;

        // Check Refresh Token
        if (!refreshToken || refreshToken === 'undefined') {
            // Logout is done at the end
            clearTokenCookies(res);
            return response(res, 200, 'Logout successful');
        }

        // Check if refreshToken is valid.
        const secret_key = process.env.JWT_REFRESH_KEY || 'default-key';
        const decoded = jwt.verify(refreshToken, secret_key);

        // Check if the user from the token exists
        const user = await userModel.findById(decoded._id);
        if (!user) {
            throw new ApiError(409, 'User not found');
        }

        // Create accessToken hash and store it Redis blacklist
        // if (accessToken) {
        //     const hashAccessToken = secureHash(accessToken);
        //     await blacklistTokenModel.create({ token: hashAccessToken });
        // }

        // Create refreshToken hash delete from refreshToken collection
        const hashRefreshToken = secureHash(refreshToken);
        await refreshTokenModel.findOneAndDelete({ token: hashRefreshToken });

        // Clear Cookie
        clearTokenCookies(res);

        // Send Response
        return response(res, 200, 'Logout successful');
    }
    catch (error) {
        // Always clear cookies on any logout error to prevent a bad state
        clearTokenCookies(res);
        next(error);
    }
}

const refreshAccessToken = async (req, res, next) => {
    const oldRefreshToken = req.cookies.refreshToken;
    try {

        // Check if refresh token exists in cookie
        if (!oldRefreshToken || oldRefreshToken === 'undefined') {
            clearTokenCookies(res);
            throw new ApiError(401, 'Refresh Token Missing');
        }

        const { user, rememberMe } = await authService.refreshToken(oldRefreshToken);

        // Generate new access and refresh token
        const newAccessToken = await generateAccessToken(user._id);
        const newRefreshToken = await generateRefreshToken(user._id, rememberMe);

        // Set Cookie
        await setAuthTokens(res, 'accessToken', newAccessToken, CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS);
        await setAuthTokens(res, 'refreshToken', newRefreshToken, rememberMe ? CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS : CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS);

        // Send Response
        return response(res, 201, 'Token Refreshed');
    }
    catch (error) {
        // Clear Cookie
        clearTokenCookies(res);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, error: 'Session Expired, Please Login Again' });
        }
        next(error);
    }
}


export default { login, register, googleAuth, checkAuth, logout, sendOTP, verifyOTP, refreshAccessToken };