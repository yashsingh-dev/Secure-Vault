import { CONSTANTS } from "../../config/constants.js";
import googleClient from "../../config/oauth.js";
import refreshTokenModel from "../../models/refreshToken.model.js";
import userModel from "../../models/user.model.js";
import ApiError from "../../utils/ApiError.js";
import { createHash, verifyHash } from "../../utils/bcrypt.utils.js";
import secureHash from "../../utils/crypto.utils.js";
import generateOTP from "../../utils/otp.utils.js";
import sendOTPEmail from "../../utils/sendMail.utils.js";
import jwt from 'jsonwebtoken';
import { formatTimeRemaining } from "../../lib/time.js";
import blacklistTokenModel from "../../models/blacklistToken.model.js";

const login = async (email, password) => {
    try {

        // Find User
        const user = await userModel.findOne({ email }).select('+password');
        if (!user) {
            throw new ApiError(401, 'Invalid email or password');
        }

        // Check Account Blocked
        if (user.isBlocked) {
            if (user.blockExpiresAt > Date.now()) {
                throw new ApiError(403, `Account is blocked for the next ${formatTimeRemaining(user.blockExpiresAt)} due to ${user.blockReason}`);
            }
            user.isBlocked = false;
            user.blockReason = null;
            user.blockedAt = null;
            user.blockExpiresAt = null;
            await user.save();
        }

        // Check if account is associated with Google
        if (user.googleLogin) {
            throw new ApiError(403, 'Account is associated with Google. Please login with Google.');
        }

        // Check Password
        const isMatch = await verifyHash(password, user.password);
        if (!isMatch) {
            throw new ApiError(401, 'Invalid email or password');
        }

        // Check 2FA
        if (user.settings.alwaysRequireOtp || !user.isVerified) {

            // Generate OTP
            const otp = generateOTP();
            user.otp = otp;
            user.otpExpiry = Date.now() + CONSTANTS.OTP.EXPIRY_MS;
            user.otpCoolDown = Date.now() + CONSTANTS.OTP.COOL_DOWN_MS;
            user.otpAttempts = 0;
            await user.save();

            // Send Email
            await sendOTPEmail(user.email, otp);

            return { user, is2FAEnabled: true };
        }

        // Update Last Login
        user.lastLogin = Date.now();
        await user.save();

        return { user, is2FAEnabled: false };
    }
    catch (error) {
        throw error;
    }
}

const register = async (name, email, password) => {
    try {

        // Check User
        const user = await userModel.findOne({ email });
        if (user) {
            throw new ApiError(409, 'User already exists');
        }

        // Encyrpt Password
        const hash_password = await createHash(password);

        // Generate OTP
        const otp = generateOTP();

        // Create User
        const new_user = await userModel.create({
            name,
            email,
            password: hash_password,
            otp,
            otpExpiry: Date.now() + CONSTANTS.OTP.EXPIRY_MS,
            otpCoolDown: Date.now() + CONSTANTS.OTP.COOL_DOWN_MS,
            otpAttempts: 0
        });

        // Send Email
        try {
            await sendOTPEmail(new_user.email, otp);
        } catch (error) {
            // Delete user if email fails to prevent deadlock (cleanup)
            await userModel.findByIdAndDelete(new_user._id);
            throw new ApiError(500, 'Failed to send verification email. Please try again.');
        }

        return { user: new_user };
    }
    catch (error) {
        throw error;
    }
}

const googleAuth = async (code) => {
    try {

        const { tokens } = await googleClient.getToken(code);

        // Local verification: No network request needed!
        const ticket = await googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const userData = await ticket.getPayload();

        // Find user or create user
        let user = await userModel.findOne({ email: userData.email });
        if (!user) {

            // Generate OTP
            const otp = generateOTP();

            // Create User
            const new_user = await userModel.create({
                name: userData.name,
                email: userData.email,
                otp,
                otpExpiry: Date.now() + CONSTANTS.OTP.EXPIRY_MS,
                otpCoolDown: Date.now() + CONSTANTS.OTP.COOL_DOWN_MS,
                otpAttempts: 0,
                googleLogin: true
            });

            // Send Email
            try {
                await sendOTPEmail(new_user.email, otp);
            } catch (error) {
                // Delete user if email fails to prevent deadlock (cleanup)
                await userModel.findByIdAndDelete(new_user._id);
                throw new ApiError(500, 'Failed to send verification email. Please try again.');
            }

            return {
                user: new_user,
                is2FAEnabled: true,
                rememberMe: true
            };
        }

        // Check Account Blocked
        if (user.isBlocked) {
            if (user.blockExpiresAt > Date.now()) {
                throw new ApiError(403, `Account is blocked for the next ${formatTimeRemaining(user.blockExpiresAt)} due to ${user.blockReason}`);
            }
            user.isBlocked = false;
            user.blockReason = null;
            user.blockedAt = null;
            user.blockExpiresAt = null;
            await user.save();
        }

        if (user.settings.alwaysRequireOtp || !user.isVerified) {

            // Generate OTP
            const otp = generateOTP();
            user.otp = otp;
            user.otpExpiry = Date.now() + CONSTANTS.OTP.EXPIRY_MS;
            user.otpCoolDown = Date.now() + CONSTANTS.OTP.COOL_DOWN_MS;
            user.otpAttempts = 0;
            await user.save();

            // Send Email
            await sendOTPEmail(user.email, otp);

            return {
                user: user,
                is2FAEnabled: true,
                rememberMe: false
            };
        }

        user.lastLogin = Date.now();
        await user.save();

        return {
            user: user,
            is2FAEnabled: false,
            rememberMe: true
        };
    }
    catch (error) {
        throw error;
    }
}

const logout = async (accessToken, refreshToken) => {
    try {

        // Check if refreshToken is valid.
        const secret_key = process.env.JWT_REFRESH_KEY || 'default-key';
        const decoded = jwt.verify(refreshToken, secret_key);

        // Check if the user from the token exists
        const user = await userModel.findById(decoded._id);
        if (!user) {
            throw new ApiError(409, 'User not found');
        }

        // Create accessToken hash and store it in blacklist
        if (accessToken) {
            const hashAccessToken = secureHash(accessToken);
            await blacklistTokenModel.create({
                token: hashAccessToken,
                userId: user._id
            });
        }

        // Create refreshToken hash delete from refreshToken collection
        const hashRefreshToken = secureHash(refreshToken);
        await refreshTokenModel.findOneAndDelete({ token: hashRefreshToken, userId: user._id });

    }
    catch (error) {
        throw error;
    }
}

const logoutAll = async (accessToken, refreshToken) => {
    try {

        // Check if refreshToken is valid.
        const secret_key = process.env.JWT_REFRESH_KEY || 'default-key';
        const decoded = jwt.verify(refreshToken, secret_key);

        // Check if the user from the token exists
        const user = await userModel.findById(decoded._id);
        if (!user) {
            throw new ApiError(409, 'User not found');
        }

        // Create accessToken hash and store it in blacklist
        if (accessToken) {
            const hashAccessToken = secureHash(accessToken);
            await blacklistTokenModel.create({
                token: hashAccessToken,
                userId: user._id
            });
        }

        // Delete all from refreshToken collection
        await refreshTokenModel.deleteMany({ userId: user._id });

        // Increment tokenVersion of user
        user.tokenVersion += 1;
        await user.save();

    }
    catch (error) {
        throw error;
    }
}

const sendOTP = async (email) => {
    try {

        // Check User
        const user = await userModel.findOne({ email });
        if (!user) {
            throw new ApiError(409, 'User not found');
        }

        // Check Account Blocked
        if (user.isBlocked) {
            if (user.blockExpiresAt > Date.now()) {
                throw new ApiError(403, `Account is blocked for the next ${formatTimeRemaining(user.blockExpiresAt)} due to ${user.blockReason}`);
            }
            user.isBlocked = false;
            user.blockReason = null;
            user.blockedAt = null;
            user.blockExpiresAt = null;
            await user.save();
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
        user.otpAttempts = 0;
        await user.save();

        // Send Email
        await sendOTPEmail(user.email, otp);

        return { user };
    }
    catch (error) {
        throw error;
    }
}

const resetPassword = async (email, password, token) => {
    try {

        // Check User
        const user = await userModel.findOne({ email });
        if (!user) {
            throw new ApiError(409, 'User not found');
        }

        // Check if Google Auth
        if (user.googleLogin) {
            throw new ApiError(403, 'Account is associated with Google. Please login with Google.');
        }

        // Check Account Blocked
        if (user.isBlocked) {
            if (user.blockExpiresAt > Date.now()) {
                throw new ApiError(403, `Account is blocked for the next ${formatTimeRemaining(user.blockExpiresAt)} due to ${user.blockReason}`);
            }
            user.isBlocked = false;
            user.blockReason = null;
            user.blockedAt = null;
            user.blockExpiresAt = null;
            await user.save();
        }

        // Verify Token
        const secret_key = process.env.JWT_ACCESS_KEY || 'default-key';
        const decoded = jwt.verify(token, secret_key);
        if (decoded._id !== user._id.toString()) {
            throw new ApiError(401, 'Invalid Token');
        }

        // Encyrpt Password
        const hash_password = await createHash(password);
        user.password = hash_password;
        user.tokenVersion += 1;
        user.resetToken = null;
        await user.save();

        return { user };
    }
    catch (error) {
        throw error;
    }
}

const verifyOTP = async (email, otp) => {
    try {

        // Check User
        const user = await userModel.findOne({ email });
        if (!user) {
            throw new ApiError(409, 'User not found');
        }

        // Check if already blocked
        if (user.otpAttempts >= 5) {
            throw new ApiError(403, 'Too many failed attempts. Please request a new OTP.');
        }

        // Check OTP
        if (!user.otp || user.otp.toString() !== otp) {
            user.otpAttempts += 1;

            // If it was the 5th attempt, clear the OTP and block the user for specific time
            if (user.otpAttempts >= 5) {
                user.otp = null;
                user.otpExpiry = null;
                user.otpCoolDown = null;
                user.isBlocked = true;
                user.blockReason = 'Too many failed OTP attempts';
                user.blockedAt = Date.now();
                user.blockExpiresAt = Date.now() + CONSTANTS.OTP.BLOCK_TIME_MS;
            }

            await user.save();
            throw new ApiError(401, 'Invalid OTP');
        }

        // Check OTP Expiry (Only if code was correct)
        if (user.otpExpiry < Date.now()) {
            throw new ApiError(401, 'OTP Expired');
        }

        // Verify OTP
        user.isVerified = true;
        user.otp = null;
        user.otpExpiry = null;
        user.otpCoolDown = null;
        user.otpAttempts = 0;
        user.lastLogin = Date.now();
        await user.save();

        return { user };

    }
    catch (error) {
        throw error;
    }
}

const verifyOtpForReset = async (email, otp) => {
    try {

        // Check User
        const user = await userModel.findOne({ email });
        if (!user) {
            throw new ApiError(409, 'User not found');
        }

        // Check if already blocked
        if (user.otpAttempts >= 5) {
            throw new ApiError(403, 'Too many failed attempts. Please request a new OTP.');
        }

        // Check OTP
        if (!user.otp || user.otp.toString() !== otp) {
            user.otpAttempts += 1;

            // If it was the 5th attempt, clear the OTP and block the user for specific time
            if (user.otpAttempts >= 5) {
                user.otp = null;
                user.otpExpiry = null;
                user.otpCoolDown = null;
                user.isBlocked = true;
                user.blockReason = 'Too many failed OTP attempts';
                user.blockedAt = Date.now();
                user.blockExpiresAt = Date.now() + CONSTANTS.OTP.BLOCK_TIME_MS;
            }

            await user.save();
            throw new ApiError(401, 'Invalid OTP');
        }

        // Check OTP Expiry (Only if code was correct)
        if (user.otpExpiry < Date.now()) {
            throw new ApiError(401, 'OTP Expired');
        }

        // Verify OTP
        user.otp = null;
        user.otpExpiry = null;
        user.otpCoolDown = null;
        user.otpAttempts = 0;
        await user.save();

        return { user };

    }
    catch (error) {
        throw error;
    }
}

const refreshToken = async (oldRefreshToken) => {
    try {

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

        console.log(currentTime, decoded.exp, decoded.iat);
        console.log(decoded.exp - currentTime > SECONDS_IN_DAY);
        console.log(currentTime - decoded.iat > SECONDS_IN_DAY);
        console.log(decoded.exp - decoded.iat > SECONDS_IN_DAY);

        if (decoded.exp - currentTime > SECONDS_IN_DAY) {
            rememberMe = true;
        } else if (currentTime - decoded.iat > SECONDS_IN_DAY) {
            rememberMe = true;
        } else if (decoded.exp - decoded.iat > SECONDS_IN_DAY) {
            rememberMe = true;
        }

        const user = await userModel.findById(decoded._id);
        if (!user) {
            throw new ApiError(409, 'User not found');
        }

        return { user, rememberMe };

    }
    catch (error) {
        throw error;
    }
}

export default { login, register, googleAuth, logout, logoutAll, sendOTP, resetPassword, verifyOTP, verifyOtpForReset, refreshToken };