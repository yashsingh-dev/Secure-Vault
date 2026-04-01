import { setAuthTokens, clearToken, clearTokenCookies } from '../utils/setCookies.utils.js'
import { verifyHash, createHash } from '../utils/bcrypt.utils.js';
import { generateAccessToken, generateRefreshToken } from '../utils/setJwtToken.utils.js';
import jwt from 'jsonwebtoken';
import userModel from '../models/user.model.js';
import refreshTokenModel from '../models/refreshToken.model.js';
import ApiError from '../utils/ApiError.js';
import response from '../utils/response.utils.js';
import { CONSTANTS } from '../config/constants.js';
import generateOTP from '../utils/otp.utils.js';
import sendTokenEmail from '../utils/sendMail.utils.js';


const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new ApiError(400, 'Email, password are required');
        }

        // Find user
        const user = await userModel.findOne({ email }).select('+password');
        if (!user) {
            throw new ApiError(401, 'Invalid email');
        }

        // Check Password
        const isMatch = await verifyHash(password, user.password);
        if (!isMatch) {
            throw new ApiError(401, 'Invalid password');
        }

        // Generate OTP
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = Date.now() + CONSTANTS.OTP.EXPIRY_MS;
        await user.save();

        // Send Email
        await sendTokenEmail(user.email, otp);

        // Send Response
        return response(res, 200, 'Login successful', {
            id: user._id,
            email: user.email
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

        // Check User
        const user = await userModel.findOne({ email });
        if (user) {
            throw new ApiError(409, 'User already exists');
        }

        // Encyrpt Password
        const hash_password = await createHash(password);

        // Add User
        const new_user = await userModel.create({ name, email, password: hash_password });

        // Generate OTP
        const otp = generateOTP();
        new_user.otp = otp;
        new_user.otpExpiry = Date.now() + CONSTANTS.OTP.EXPIRY_MS;
        await new_user.save();

        // Send Email
        await sendTokenEmail(new_user.email, otp);

        // Send Response
        return response(res, 201, 'Registered successfully', {
            id: new_user._id,
            email: new_user.email
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

        // Check User
        const user = await userModel.findOne({ email });
        if (!user) {
            throw new ApiError(409, 'User not found');
        }

        // Generate OTP
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = Date.now() + CONSTANTS.OTP.EXPIRY_MS;
        await user.save();

        // Send Email
        await sendTokenEmail(user.email, otp);

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
        const { email, otp } = req.body;

        if (!email || !otp) {
            throw new ApiError(400, 'Email, otp are required');
        }

        // Check User
        const user = await userModel.findOne({ email }).select('+otp +otpExpiry');
        if (!user) {
            throw new ApiError(409, 'User not found');
        }

        // Check OTP
        if (user.otp !== otp) {
            throw new ApiError(401, 'Invalid OTP');
        }

        // Check OTP Expiry
        if (user.otpExpiry < Date.now()) {
            throw new ApiError(401, 'OTP Expired');
        }

        // Verify OTP
        user.isVerified = true;
        user.otp = null;
        user.otpExpiry = null;
        await user.save();

        // Generate JWT Token
        const accessToken = await generateAccessToken(user._id);
        const refreshToken = await generateRefreshToken(user._id);

        // Set Cookie
        await setAuthTokens(res, 'accessToken', accessToken, CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS);
        await setAuthTokens(res, 'refreshToken', refreshToken, CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS);

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

const logout = async (req, res, next) => {
    try {
        const accessToken = req.cookies.accessToken;
        const refreshToken = req.cookies.refreshToken;

        // Check Refresh Token
        if (!refreshToken || refreshToken === 'undefined') {
            // Logout is done at the end
            clearTokenCookies(res);
            return res.status(200).json({ success: true, message: 'Logout successful' });
        }

        // Check if refreshToken is valid.
        const secret_key = process.env.JWT_REFRESH_KEY || 'default-key';
        const decoded = jwt.verify(refreshToken, secret_key);

        // Check if the user from the token exists
        const admin = await adminModel.findById(decoded._id);
        if (!admin) {
            throw new ApiError(409, 'Admin not found');
        }

        // Create accessToken hash and it in blacklist collection
        if (accessToken) {
            const hashAccessToken = secureHash(accessToken);
            await blacklistTokenModel.create({ token: hashAccessToken });
        }

        // Create refreshToken hash delete from refreshToken collection
        const hashRefreshToken = secureHash(refreshToken);
        await refreshTokenModel.findOneAndDelete({ token: hashRefreshToken });

        // Clear Cookie
        clearTokenCookies(res);

        return res.status(200).json({
            success: true,
            message: MESSAGES.LOGOUT_SUCCESS
        });
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
            clearToken(res, COOKIES.REFRESH_TOKEN);
            throw new ApiError(401, 'Refresh Token Missing');
        }

        // Create refreshToken hash and check if it exists in DB
        const hashRefreshToken = secureHash(oldRefreshToken);
        const tokenDoc = await refreshTokenModel.findOne({ token: hashRefreshToken });
        if (!tokenDoc) {
            throw new ApiError(403, 'Invalid Refresh Token');
        }

        // Verify refresh token and expiry using its secret key
        const secret_key = process.env.JWT_REFRESH_KEY || 'default-key';
        const decoded = jwt.verify(oldRefreshToken, secret_key);

        // Delete old refresh token hash from DB
        await refreshTokenModel.findOneAndDelete({ token: hashRefreshToken });

        // Get Admin from collection using decoded token id
        const admin = await adminModel.findById(decoded._id);

        if (!admin) {
            throw new ApiError(409, 'Admin Not Found');
        }

        // Generate new access and refresh token
        const newAccessToken = await generateAccessToken(decoded._id);
        const newRefreshToken = await generateRefreshToken(decoded._id);

        // Set Cookie
        await setAuthTokens(res, COOKIES.ACCESS_TOKEN, newAccessToken, TOKEN_EXPIRY.ACCESS_TOKEN_MS);
        await setAuthTokens(res, COOKIES.REFRESH_TOKEN, newRefreshToken, TOKEN_EXPIRY.REFRESH_TOKEN_MS);

        return res.status(200).json({
            success: true,
            message: 'Token Refreshed'
        });
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


export default { login, register, logout, sendOTP, verifyOTP, refreshAccessToken };