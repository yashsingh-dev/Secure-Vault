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
import secureHash from '../utils/crypto.utils.js';


const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new ApiError(400, 'Email, password are required');
        }

        // Find user
        const user = await userModel.findOne({ email }).select('+password');
        if (!user) {
            throw new ApiError(401, 'Invalid email or password');
        }

        // Check Password
        const isMatch = await verifyHash(password, user.password);
        if (!isMatch) {
            throw new ApiError(401, 'Invalid email or password');
        }

        // Generate OTP
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = Date.now() + CONSTANTS.OTP.EXPIRY_MS;
        user.otpCoolDown = Date.now() + CONSTANTS.OTP.COOL_DOWN_MS;
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
        new_user.otpCoolDown = Date.now() + CONSTANTS.OTP.COOL_DOWN_MS;
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

        // Check OTP Cool Down
        if (user.otpCoolDown > Date.now()) {
            throw new ApiError(400, 'OTP Cool Down');
        }

        // Generate OTP
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = Date.now() + CONSTANTS.OTP.EXPIRY_MS;
        user.otpCoolDown = Date.now() + CONSTANTS.OTP.COOL_DOWN_MS;
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
        const { email, otp, rememberMe = false } = req.body;

        if (!email || !otp) {
            throw new ApiError(400, 'Email, otp are required');
        }

        // Check User
        const user = await userModel.findOne({ email }).select('+otp +otpExpiry');
        if (!user) {
            throw new ApiError(409, 'User not found');
        }

        // Check OTP
        if (!user.otp || user.otp.toString() !== otp) {
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
        user.otpCoolDown = null;
        await user.save();

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

        // Determine rememberMe based on the refresh token's age and expiry
        const SECONDS_IN_DAY = 24 * 60 * 60;
        const currentTime = Math.floor(Date.now() / 1000);
        let rememberMe = false;

        if (decoded.exp - currentTime > SECONDS_IN_DAY) {
            rememberMe = true;
        } else if (currentTime - decoded.iat > SECONDS_IN_DAY) {
            rememberMe = true;
        } else if (decoded.exp - decoded.iat > SECONDS_IN_DAY) {
            rememberMe = true;
        }

        // Generate new access and refresh token
        const newAccessToken = await generateAccessToken(decoded._id);
        const newRefreshToken = await generateRefreshToken(decoded._id, rememberMe);

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


export default { login, register, checkAuth, logout, sendOTP, verifyOTP, refreshAccessToken };