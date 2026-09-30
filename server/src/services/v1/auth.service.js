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
import { parseUserAgent } from "../../utils/device.utils.js";

const login = async (email, password) => {
    try {

        // Find User
        const user = await userModel.findOne({ email }).select('+password');
        if (!user) {
            throw new ApiError(401, 'Incorrect email or password. Please try again.');
        }

        // Check Account Blocked
        let currentUser = user;
        if (currentUser.isBlocked) {
            if (currentUser.blockExpiresAt > Date.now()) {
                throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(currentUser.blockExpiresAt)} due to ${currentUser.blockReason}.`);
            }

            // Atomically unblock ONLY if isBlocked is still true in the database
            const unblockedUser = await userModel.findOneAndUpdate(
                { _id: currentUser._id, isBlocked: true },
                {
                    $set: {
                        isBlocked: false,
                        blockReason: null,
                        blockedAt: null,
                        blockExpiresAt: null
                    }
                },
                { new: true }
            ).select('+password');

            if (unblockedUser) {
                currentUser = unblockedUser;
            } else {
                // Another concurrent request completed the unblock right before this one.
                // Fetch the fresh document to ensure our in-memory data matches the true DB state.
                const freshUser = await userModel.findById(currentUser._id).select('+password');
                if (freshUser) {
                    currentUser = freshUser;
                    // Check if a subsequent event/admin re-blocked the user in that tiny window
                    if (currentUser.isBlocked && currentUser.blockExpiresAt > Date.now()) {
                        throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(currentUser.blockExpiresAt)} due to ${currentUser.blockReason}.`);
                    }
                }
            }
        }

        // Check if account is associated with Google
        if (currentUser.googleLogin) {
            throw new ApiError(403, 'This account was registered using Google. Please sign in with Google.');
        }

        // Check Password
        const isMatch = await verifyHash(password, currentUser.password);
        if (!isMatch) {
            throw new ApiError(401, 'Incorrect email or password. Please try again.');
        }

        // Check 2FA
        if (currentUser.settings.alwaysRequireOtp || !currentUser.isVerified) {
            const now = Date.now();

            // 1. If cooldown is currently active, don't generate a new OTP or send another email.
            // Allow the user to proceed to the OTP verification screen for the existing code.
            if (currentUser.otpCoolDown && currentUser.otpCoolDown > now && currentUser.otpExpiry > now) {
                return { user: currentUser, is2FAEnabled: true };
            }

            // 2. Generate new OTP parameters
            const otp = generateOTP();
            const otpExpiry = now + CONSTANTS.OTP.EXPIRY_MS;
            const otpCoolDown = now + CONSTANTS.OTP.COOL_DOWN_MS;

            // 3. Atomically update the database only if cooldown is expired
            const updatedUser = await userModel.findOneAndUpdate(
                {
                    _id: currentUser._id,
                    $or: [
                        { otpCoolDown: null },
                        { otpCoolDown: { $lte: now } }
                    ]
                },
                {
                    $set: {
                        otp,
                        otpExpiry,
                        otpCoolDown,
                        otpAttempts: 0
                    }
                },
                { new: true }
            );

            // If another concurrent request just updated the OTP milliseconds ago,
            // updatedUser will be null. We safely return without sending a conflicting email.
            if (!updatedUser) {
                return { user: currentUser, is2FAEnabled: true };
            }

            // 4. Send email; if sending fails, roll back the OTP so the user isn't stuck
            try {
                await sendOTPEmail(currentUser.email, otp);
            } catch (error) {
                // Rollback OTP in DB so user is not stuck with an unsent code
                await userModel.updateOne(
                    { _id: currentUser._id },
                    { $set: { otp: null, otpExpiry: null, otpCoolDown: null, otpAttempts: 0 } }
                );
                throw new ApiError(500, 'Unable to send verification code. Please try again.');
            }

            return { user: updatedUser, is2FAEnabled: true };
        }

        // Update Last Login atomically without overwriting any other fields or relying on in-memory .save()
        const now = Date.now();
        await userModel.updateOne(
            { _id: currentUser._id },
            { $set: { lastLogin: now } }
        );
        currentUser.lastLogin = now;

        return { user: currentUser, is2FAEnabled: false };
    }
    catch (error) {
        throw error;
    }
}

const register = async (name, email, password) => {
    try {

        // Check User
        const user = await userModel.findOne({ email }).select({ _id: 0, email: 1 }).lean();
        if (user) {
            throw new ApiError(409, 'An account with this email already exists. Please sign in instead.');
        }

        // Encyrpt Password
        const hash_password = await createHash(password);

        // Generate OTP
        const otp = generateOTP();

        // Create User
        let new_user;
        try {
            new_user = await userModel.create({
                name,
                email,
                password: hash_password,
                otp,
                otpExpiry: Date.now() + CONSTANTS.OTP.EXPIRY_MS,
                otpCoolDown: Date.now() + CONSTANTS.OTP.COOL_DOWN_MS,
                otpAttempts: 0
            });
        } catch (dbError) {
            if (dbError.code === 11000) {
                throw new ApiError(409, 'An account with this email already exists. Please sign in instead.');
            }
            throw dbError;
        }

        // Send Email
        try {
            const result = await sendOTPEmail(new_user.email, otp);
            if (!result.success) throw new Error(result.error);
            // throw new Error("Email not sent");
        } catch (error) {
            // Delete user if email fails to prevent deadlock (cleanup)
            await userModel.findByIdAndDelete(new_user._id);
            throw new ApiError(500, 'Unable to send verification email. Please try again in a few moments.');
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
            audience: process.env.OAUTH_GOOGLE_CLIENT_ID
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
                const result = await sendOTPEmail(new_user.email, otp);
                if (!result.success) throw new Error(result.error);
            } catch (error) {
                // Delete user if email fails to prevent deadlock (cleanup)
                await userModel.findByIdAndDelete(new_user._id);
                throw new ApiError(500, 'Unable to send verification email. Please try again in a few moments.');
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
                throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(user.blockExpiresAt)} due to ${user.blockReason}.`);
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
            const result = await sendOTPEmail(user.email, otp);
            if (!result.success) throw new Error(result.error);

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
            throw new ApiError(409, 'No account found with this email address.');
        }

        // Create accessToken hash and store it in blacklist
        if (accessToken) {
            const hashAccessToken = secureHash(accessToken);
            await blacklistTokenModel.create({
                token: hashAccessToken,
                userId: user._id
            });
        }

        // Create refreshToken hash and delete entire token family from refreshToken collection
        const hashRefreshToken = secureHash(refreshToken);
        const tokenDoc = await refreshTokenModel.findOne({ token: hashRefreshToken, userId: user._id });
        if (tokenDoc) {
            const familyId = tokenDoc.familyId || tokenDoc._id;
            await refreshTokenModel.deleteMany({ familyId });
        }

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
            throw new ApiError(409, 'No account found with this email address.');
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
            throw new ApiError(409, 'No account found with this email address.');
        }

        // Check Account Blocked
        if (user.isBlocked) {
            if (user.blockExpiresAt > Date.now()) {
                throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(user.blockExpiresAt)} due to ${user.blockReason}.`);
            }
            user.isBlocked = false;
            user.blockReason = null;
            user.blockedAt = null;
            user.blockExpiresAt = null;
            await user.save();
        }

        // Check OTP Cool Down
        if (user.otpCoolDown > Date.now()) {
            throw new ApiError(400, 'Please wait before requesting another verification code.');
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
            throw new ApiError(409, 'No account found with this email address.');
        }

        // Check if Google Auth
        if (user.googleLogin) {
            throw new ApiError(403, 'This account was registered using Google. Please sign in with Google.');
        }

        // Check Account Blocked
        if (user.isBlocked) {
            if (user.blockExpiresAt > Date.now()) {
                throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(user.blockExpiresAt)} due to ${user.blockReason}.`);
            }
            user.isBlocked = false;
            user.blockReason = null;
            user.blockedAt = null;
            user.blockExpiresAt = null;
            await user.save();
        }

        // Check for token
        if (!user.resetToken || user.resetToken !== token) {
            throw new ApiError(401, 'Invalid or expired password reset link.');
        }

        // Verify Token
        const secret_key = process.env.JWT_RESET_KEY || 'default-key';
        const decoded = jwt.verify(token, secret_key);
        if (decoded._id !== user._id.toString()) {
            throw new ApiError(401, 'Invalid or expired password reset link.');
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

        // ATOMIC CHECK & INCREMENT IN DATABASE:
        // Only increment if otpAttempts is STRICTLY LESS THAN 5, and account is not blocked!
        const user = await userModel.findOneAndUpdate(
            {
                email,
                otpAttempts: { $lt: 5 },
                $or: [{ isBlocked: false }, { blockExpiresAt: { $lt: Date.now() } }]
            },
            {
                $inc: { otpAttempts: 1 }
            },
            { new: true }
        );

        // If no document was matched, it means:
        // - Either the user doesn't exist, OR
        // - otpAttempts is ALREADY >= 5!
        if (!user) {
            // Find user to check if they are locked out
            const existingUser = await userModel.findOne({ email });
            if (!existingUser) {
                throw new ApiError(409, 'No account found with this email address.');
            }
            // They hit 5 attempts or are blocked
            throw new ApiError(403, 'Too many incorrect attempts. Please request a new verification code.');
        }
        if (!user.otp) {
            throw new ApiError(401, 'No verification code found. Please request a new one.');
        }

        // Check OTP
        if (!user.otp || user.otp.toString() !== otp) {
            // If it was the 5th attempt, clear the OTP and block the user for specific time
            if (user.otpAttempts >= 5) {
                user.otp = null;
                user.otpExpiry = null;
                user.otpCoolDown = null;

                user.isBlocked = true;
                user.blockReason = 'Too many failed OTP attempts';
                user.blockedAt = Date.now();
                user.blockExpiresAt = Date.now() + CONSTANTS.OTP.BLOCK_TIME_MS;
                await user.save();
            }

            throw new ApiError(401, 'Incorrect verification code. Please check and try again.');
        }

        // Check OTP Expiry (Only if code was correct)
        if (user.otpExpiry < Date.now()) {
            throw new ApiError(401, 'This verification code has expired. Please request a new one.');
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

        // ATOMIC CHECK & INCREMENT IN DATABASE:
        // Only increment if otpAttempts is STRICTLY LESS THAN 5, and account is not blocked!
        const user = await userModel.findOneAndUpdate(
            {
                email,
                otpAttempts: { $lt: 5 },
                $or: [{ isBlocked: false }, { blockExpiresAt: { $lt: Date.now() } }]
            },
            {
                $inc: { otpAttempts: 1 }
            },
            { new: true }
        );

        if (!user) {
            const existingUser = await userModel.findOne({ email });
            if (!existingUser) {
                throw new ApiError(409, 'No account found with this email address.');
            }
            throw new ApiError(403, 'Too many incorrect attempts. Please request a new verification code.');
        }

        if (!user.otp) {
            throw new ApiError(401, 'No verification code found. Please request a new one.');
        }

        // Check OTP
        if (!user.otp || user.otp.toString() !== otp) {
            // If it was the 5th attempt, clear the OTP and block the user for specific time
            if (user.otpAttempts >= 5) {
                user.otp = null;
                user.otpExpiry = null;
                user.otpCoolDown = null;
                user.isBlocked = true;
                user.blockReason = 'Too many failed OTP attempts';
                user.blockedAt = Date.now();
                user.blockExpiresAt = Date.now() + CONSTANTS.OTP.BLOCK_TIME_MS;
                await user.save();
            }

            throw new ApiError(401, 'Incorrect verification code. Please check and try again.');
        }

        // Check OTP Expiry (Only if code was correct)
        if (user.otpExpiry < Date.now()) {
            throw new ApiError(401, 'This verification code has expired. Please request a new one.');
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
            throw new ApiError(403, 'Session expired or invalid. Please sign in again.');
        }

        const familyId = tokenDoc.familyId;

        // CHECK GRACE PERIOD: Has this token already been rotated?
        if (tokenDoc.isRotated) {
            const GRACE_PERIOD_MS = 10 * 1000; // 10 seconds grace period
            const timeSinceRotation = Date.now() - new Date(tokenDoc.rotatedAt).getTime();
            if (timeSinceRotation <= GRACE_PERIOD_MS) {
                // Allowed! A concurrent request arrived right after rotation.
                // Fetch the user and return without creating a loop.
                const user = await userModel.findById(tokenDoc.userId);
                if (!user) throw new ApiError(409, 'No account found with this email address.');

                return { user, rememberMe: true, isGracePeriod: true, familyId };
            }
            else {
                // If used AFTER 10 seconds, this is a REUSE ATTACK (stolen token)!
                // Security measure: Invalidate ONLY this compromised token family!
                await refreshTokenModel.deleteMany({ familyId });
                throw new ApiError(403, 'Compromised token detected. Please sign in again.');
            }

        }

        // First time rotation: Mark it as rotated instead of deleting immediately!
        tokenDoc.isRotated = true;
        tokenDoc.rotatedAt = Date.now();
        await tokenDoc.save();

        // Verify refresh token and expiry using its secret key
        const secret_key = process.env.JWT_REFRESH_KEY || 'default-key';
        const decoded = jwt.verify(oldRefreshToken, secret_key);

        // Determine rememberMe based on the refresh token's age and expiry
        const SECONDS_IN_DAY = 24 * 60 * 60;
        let rememberMe = (decoded.exp - decoded.iat > SECONDS_IN_DAY);

        const user = await userModel.findById(decoded._id);
        if (!user) {
            throw new ApiError(409, 'No account found with this email address.');
        }

        return { user, rememberMe, isGracePeriod: false, familyId };

    }
    catch (error) {
        throw error;
    }
}

const getSessions = async (userId, currentRefreshToken) => {
    try {
        let currentTokenHash = null;
        if (currentRefreshToken && currentRefreshToken !== 'undefined') {
            currentTokenHash = secureHash(currentRefreshToken);

            // Touch lastActive for current session
            await refreshTokenModel.updateOne(
                { token: currentTokenHash, userId },
                { $set: { lastActive: new Date() } }
            );
        }

        // Fetch all active, non-rotated refresh tokens for the user
        const tokenDocs = await refreshTokenModel.find({
            userId,
            isRotated: false
        }).sort({ lastActive: -1, createdAt: -1 }).lean();

        const sessions = tokenDocs.map((doc) => {
            const isCurrent = Boolean(currentTokenHash && doc.token === currentTokenHash);

            let browser = doc.browser;
            let os = doc.os;
            let device = doc.device;

            // Fallback parse if default/unknown but userAgent exists
            if ((!browser || browser === 'Unknown Browser') && doc.userAgent) {
                const parsed = parseUserAgent(doc.userAgent);
                browser = parsed.browser;
                os = parsed.os;
                device = parsed.device;
            }

            return {
                id: doc._id.toString(),
                familyId: (doc.familyId || doc._id).toString(),
                ip: doc.ip || 'Unknown IP',
                device: device || 'Desktop',
                browser: browser || 'Unknown Browser',
                os: os || 'Unknown OS',
                userAgent: doc.userAgent || '',
                createdAt: doc.createdAt,
                lastActive: doc.lastActive || doc.updatedAt || doc.createdAt,
                isCurrent
            };
        });

        // Ensure current session appears at the top
        sessions.sort((a, b) => {
            if (a.isCurrent && !b.isCurrent) return -1;
            if (!a.isCurrent && b.isCurrent) return 1;
            return new Date(b.lastActive) - new Date(a.lastActive);
        });

        return sessions;
    } catch (error) {
        throw error;
    }
};

const revokeSession = async (userId, sessionId, currentRefreshToken) => {
    try {
        const session = await refreshTokenModel.findOne({ _id: sessionId, userId });
        if (!session) {
            throw new ApiError(404, 'Session not found or already terminated.');
        }

        let isCurrent = false;
        if (currentRefreshToken && currentRefreshToken !== 'undefined') {
            const currentTokenHash = secureHash(currentRefreshToken);
            if (session.token === currentTokenHash) {
                isCurrent = true;
            }
        }

        const familyId = session.familyId || session._id;
        await refreshTokenModel.deleteMany({ familyId });

        return { isCurrent };
    } catch (error) {
        throw error;
    }
};

export default {
    login,
    register,
    googleAuth,
    logout,
    logoutAll,
    sendOTP,
    resetPassword,
    verifyOTP,
    verifyOtpForReset,
    refreshToken,
    getSessions,
    revokeSession
};