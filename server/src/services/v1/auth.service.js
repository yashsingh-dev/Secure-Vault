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
import mongoose from "mongoose";

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
        const now = Date.now();
        if (currentUser.settings.alwaysRequireOtp || !currentUser.isVerified) {

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
        const now = Date.now();
        const otp = generateOTP();

        // Create User
        let new_user;
        try {
            new_user = await userModel.create({
                name,
                email,
                password: hash_password,
                otp,
                otpExpiry: now + CONSTANTS.OTP.EXPIRY_MS,
                otpCoolDown: now + CONSTANTS.OTP.COOL_DOWN_MS,
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

        let tokens;
        try {
            const response = await googleClient.getToken(code);
            tokens = response.tokens;
        } catch (oauthError) {
            const errorDesc = oauthError?.response?.data?.error_description || oauthError?.message || '';
            if (oauthError?.response?.data?.error === 'invalid_grant' || errorDesc.includes('already redeemed') || errorDesc.includes('invalid_grant')) {
                throw new ApiError(400, 'This Google sign-in request has already been processed or expired. Please refresh the page.');
            }
            throw new ApiError(400, 'Failed to authenticate with Google. Please try signing in again.');
        }

        // Local verification: No network request needed!
        const ticket = await googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.OAUTH_GOOGLE_CLIENT_ID
        });

        const userData = await ticket.getPayload();
        const now = Date.now();

        // Find user or create user
        let user = await userModel.findOne({ email: userData.email });
        if (!user) {

            // Generate OTP
            const otp = generateOTP();

            // Create User with duplicate key error safety
            let new_user;
            try {
                new_user = await userModel.create({
                    name: userData.name,
                    email: userData.email,
                    otp,
                    otpExpiry: Date.now() + CONSTANTS.OTP.EXPIRY_MS,
                    otpCoolDown: Date.now() + CONSTANTS.OTP.COOL_DOWN_MS,
                    otpAttempts: 0,
                    googleLogin: true
                });
            } catch (dbError) {
                if (dbError.code === 11000) {
                    // Account was created concurrently, fetch it
                    user = await userModel.findOne({ email: userData.email });
                    if (!user) {
                        throw new ApiError(409, 'An account with this email already exists.');
                    }
                } else {
                    throw dbError;
                }
            }

            if (new_user) {
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
            );

            if (unblockedUser) {
                currentUser = unblockedUser;
            } else {
                // Another concurrent request completed the unblock right before this one.
                const freshUser = await userModel.findById(currentUser._id);
                if (freshUser) {
                    currentUser = freshUser;
                    if (currentUser.isBlocked && currentUser.blockExpiresAt > Date.now()) {
                        throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(currentUser.blockExpiresAt)} due to ${currentUser.blockReason}.`);
                    }
                }
            }
        }

        // Check 2FA
        if (currentUser.settings.alwaysRequireOtp || !currentUser.isVerified) {

            // 1. If cooldown is currently active, don't generate a new OTP or send another email.
            if (currentUser.otpCoolDown && currentUser.otpCoolDown > now && currentUser.otpExpiry > now) {
                return {
                    user: currentUser,
                    is2FAEnabled: true,
                    rememberMe: false
                };
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

            // If another concurrent request just updated the OTP milliseconds ago
            if (!updatedUser) {
                return {
                    user: currentUser,
                    is2FAEnabled: true,
                    rememberMe: false
                };
            }

            // 4. Send email; if sending fails, roll back the OTP in DB
            try {
                const result = await sendOTPEmail(currentUser.email, otp);
                if (!result.success) throw new Error(result.error);
            } catch (error) {
                await userModel.updateOne(
                    { _id: currentUser._id },
                    { $set: { otp: null, otpExpiry: null, otpCoolDown: null, otpAttempts: 0 } }
                );
                throw new ApiError(500, 'Unable to send verification code. Please try again.');
            }

            return {
                user: updatedUser,
                is2FAEnabled: true,
                rememberMe: false
            };
        }

        // Update Last Login atomically without relying on in-memory .save()
        await userModel.updateOne(
            { _id: currentUser._id },
            { $set: { lastLogin: now } }
        );
        currentUser.lastLogin = now;

        return {
            user: currentUser,
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
        let userId = null;

        // 1. Invalidate Refresh Token Session Family if refreshToken exists
        if (refreshToken && refreshToken !== 'undefined') {
            try {
                const hashedRefreshToken = secureHash(refreshToken);
                const tokenDoc = await refreshTokenModel.findOne({ token: hashedRefreshToken });
                if (tokenDoc) {
                    userId = tokenDoc.userId;
                    const familyId = tokenDoc.familyId || tokenDoc._id;
                    await refreshTokenModel.deleteMany({ familyId });
                }
            } catch (err) {
                // Silently continue if refresh token lookup fails
            }
        }

        // 2. Blacklist Access Token if provided
        if (accessToken && accessToken !== 'undefined') {
            try {
                // If we don't have userId yet, try to decode from accessToken (even if expired)
                if (!userId) {
                    const decoded = jwt.decode(accessToken);
                    if (decoded && decoded._id) {
                        userId = decoded._id;
                    }
                }

                if (userId) {
                    const hashedAccessToken = secureHash(accessToken);
                    // Use updateOne with upsert to prevent duplicate key crashes on concurrent logout
                    await blacklistTokenModel.updateOne(
                        { token: hashedAccessToken },
                        { $setOnInsert: { token: hashedAccessToken, userId, createdAt: new Date() } },
                        { upsert: true }
                    );
                }
            } catch (err) {
                // Silently ignore blacklist insertion failures during logout
            }
        }

        return true;
    }
    catch (error) {
        throw error;
    }
}

const logoutAll = async (accessToken, refreshToken, authenticatedUserId = null) => {
    try {
        let userId = authenticatedUserId;

        // 1. Identify User from refreshToken if not passed from req.user
        if (!userId && refreshToken && refreshToken !== 'undefined') {
            try {
                const secret_key = process.env.JWT_REFRESH_KEY || 'default-key';
                const decoded = jwt.verify(refreshToken, secret_key);
                userId = decoded._id;
            } catch (err) {
                const decoded = jwt.decode(refreshToken);
                if (decoded && decoded._id) userId = decoded._id;
            }
        }

        // 2. Identify from accessToken if still needed
        if (!userId && accessToken && accessToken !== 'undefined') {
            const decoded = jwt.decode(accessToken);
            if (decoded && decoded._id) userId = decoded._id;
        }

        if (userId) {
            // Concurrently delete all active sessions, increment tokenVersion atomically, and blacklist accessToken
            const tasks = [
                refreshTokenModel.deleteMany({ userId }),
                userModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } })
            ];

            if (accessToken && accessToken !== 'undefined') {
                const hashAccessToken = secureHash(accessToken);
                tasks.push(
                    blacklistTokenModel.updateOne(
                        { token: hashAccessToken },
                        { $setOnInsert: { token: hashAccessToken, userId, createdAt: new Date() } },
                        { upsert: true }
                    )
                );
            }

            await Promise.all(tasks);
        }

        return true;
    }
    catch (error) {
        throw error;
    }
}

const sendOTP = async (email) => {
    try {

        // Check User
        let user = await userModel.findOne({ email }).select({ isBlocked: 1, blockExpiresAt: 1, blockReason: 1, otpCoolDown: 1, otp: 1 }).lean();
        if (!user) {
            throw new ApiError(404, 'No account found with this email address.');
        }

        const now = Date.now();

        // Check Account Blocked
        if (user.isBlocked) {
            if (user.blockExpiresAt > now) {
                throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(user.blockExpiresAt)} due to ${user.blockReason}.`);
            }

            // Atomically unblock if still blocked
            const unblockedUser = await userModel.findOneAndUpdate(
                { _id: user._id, isBlocked: true },
                {
                    $set: {
                        isBlocked: false,
                        blockReason: null,
                        blockedAt: null,
                        blockExpiresAt: null
                    }
                },
                { new: true }
            );

            if (unblockedUser) {
                user = unblockedUser;
            } else {
                // Another concurrent request completed the unblock right before this one.
                const freshUser = await userModel.findById(user._id);
                if (freshUser) {
                    user = freshUser;
                    if (user.isBlocked && user.blockExpiresAt > now) {
                        throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(user.blockExpiresAt)} due to ${user.blockReason}.`);
                    }
                }
            }
        }

        // Generate OTP parameters
        const otp = generateOTP();
        const otpExpiry = now + CONSTANTS.OTP.EXPIRY_MS;
        const otpCoolDown = now + CONSTANTS.OTP.COOL_DOWN_MS;

        // Atomically update user ONLY if cooldown is null or has expired
        const updatedUser = await userModel.findOneAndUpdate(
            {
                _id: user._id,
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

        // If updatedUser is null, another concurrent request just requested an OTP milliseconds ago
        if (!updatedUser) {
            throw new ApiError(429, 'Please wait before requesting another verification code.');
        }

        // Send Email with rollback on failure
        try {
            const result = await sendOTPEmail(user.email, otp);
            if (result && !result.success) throw new Error(result.error);
        } catch (error) {
            // Rollback OTP in DB so user isn't stuck with an unsent code
            await userModel.updateOne(
                { _id: user._id },
                { $set: { otp: null, otpExpiry: null, otpCoolDown: null, otpAttempts: 0 } }
            );
            throw new ApiError(500, 'Unable to send verification code. Please try again.');
        }

        return { user: updatedUser };
    }
    catch (error) {
        throw error;
    }
}

const resetPassword = async (email, password, token) => {
    try {

        const now = Date.now();

        // 1. Check User
        let user = await userModel.findOne({ email });
        if (!user) {
            throw new ApiError(404, 'No account found with this email address.');
        }

        // 2. Check if Google Auth
        if (user.googleLogin) {
            throw new ApiError(403, 'This account was registered using Google. Please sign in with Google.');
        }

        // 3. Check Account Blocked
        if (user.isBlocked) {
            if (user.blockExpiresAt > now) {
                throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(user.blockExpiresAt)} due to ${user.blockReason}.`);
            }

            // Unblock atomically if expired
            await userModel.updateOne(
                { _id: user._id, isBlocked: true },
                {
                    $set: {
                        isBlocked: false,
                        blockReason: null,
                        blockedAt: null,
                        blockExpiresAt: null
                    }
                }
            );
            user.isBlocked = false;
        }

        // 4. Check for token existence and match
        if (!user.resetToken || user.resetToken !== token) {
            throw new ApiError(401, 'Invalid or expired password reset link.');
        }

        // 5. Verify Token Cryptographically
        const secret_key = process.env.JWT_RESET_KEY || 'default-key';
        const decoded = jwt.verify(token, secret_key);
        if (decoded._id !== user._id.toString()) {
            throw new ApiError(401, 'Invalid or expired password reset link.');
        }

        // 6. Encrypt Password
        const hash_password = await createHash(password);

        // 7. Atomic "Claim & Burn" Update:
        // Only succeeds if resetToken is STILL exactly equal to the token!
        // This guarantees strict single-use even if concurrent requests arrive.
        const updatedUser = await userModel.findOneAndUpdate(
            {
                _id: user._id,
                resetToken: token
            },
            {
                $set: {
                    password: hash_password,
                    resetToken: null
                },
                $inc: { tokenVersion: 1 }
            },
            { new: true }
        );

        if (!updatedUser) {
            throw new ApiError(401, 'This password reset link has already been used or expired.');
        }

        // 8. Revoke all active refresh token sessions for this user
        await refreshTokenModel.deleteMany({ userId: user._id });

        return { user: updatedUser };
    }
    catch (error) {
        throw error;
    }
}

const verifyOTP = async (email, otp) => {
    try {

        const now = Date.now();

        // 1. Check user existence and block status first to give accurate errors
        const user = await userModel.findOne({ email });
        if (!user) {
            throw new ApiError(404, 'No account found with this email address.');
        }

        if (user.isBlocked) {
            if (user.blockExpiresAt > now) {
                throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(user.blockExpiresAt)} due to ${user.blockReason}.`);
            }

            // Unblock atomically if block has expired
            await userModel.updateOne(
                { _id: user._id, isBlocked: true },
                {
                    $set: {
                        isBlocked: false,
                        blockReason: null,
                        blockedAt: null,
                        blockExpiresAt: null
                    }
                }
            );
            user.isBlocked = false;
        }

        // 2. Check if an active OTP was actually requested
        if (!user.otp) {
            throw new ApiError(400, 'No active verification code found. Please request a new one.');
        }

        // 3. Atomically claim attempt: only increment if otpAttempts < 5
        const updatedUser = await userModel.findOneAndUpdate(
            {
                _id: user._id,
                otpAttempts: { $lt: 5 }
            },
            {
                $inc: { otpAttempts: 1 }
            },
            { new: true }
        );

        // If updatedUser is null, user already hit the maximum 5 attempts
        if (!updatedUser) {
            throw new ApiError(403, 'Too many incorrect attempts. Please request a new verification code.');
        }

        // 4. Check if the provided OTP matches
        if (updatedUser.otp.toString() !== otp.toString()) {
            // If this was the 5th failed attempt, block the user atomically
            if (updatedUser.otpAttempts >= 5) {
                await userModel.updateOne(
                    { _id: updatedUser._id },
                    {
                        $set: {
                            otp: null,
                            otpExpiry: null,
                            otpCoolDown: null,
                            isBlocked: true,
                            blockReason: 'Too many failed OTP attempts',
                            blockedAt: now,
                            blockExpiresAt: now + CONSTANTS.OTP.BLOCK_TIME_MS
                        }
                    }
                );
            }

            throw new ApiError(401, 'Incorrect verification code. Please check and try again.');
        }

        // 5. Check OTP Expiry
        if (updatedUser.otpExpiry < now) {
            throw new ApiError(401, 'This verification code has expired. Please request a new one.');
        }

        // 6. Success: Atomically mark verified, clear OTP fields, and update lastLogin
        await userModel.updateOne(
            { _id: updatedUser._id },
            {
                $set: {
                    isVerified: true,
                    otp: null,
                    otpExpiry: null,
                    otpCoolDown: null,
                    otpAttempts: 0,
                    lastLogin: now
                }
            }
        );

        updatedUser.isVerified = true;
        updatedUser.otp = null;
        updatedUser.otpExpiry = null;
        updatedUser.otpCoolDown = null;
        updatedUser.otpAttempts = 0;
        updatedUser.lastLogin = now;

        return { user: updatedUser };

    }
    catch (error) {
        throw error;
    }
}

const refreshToken = async (oldRefreshToken) => {
    try {

        const now = Date.now();
        const GRACE_PERIOD_MS = 10 * 1000; // 10 seconds grace period

        // 1. Verify refresh token cryptographic validity first
        const secret_key = process.env.JWT_REFRESH_KEY || 'default-key';
        const decoded = jwt.verify(oldRefreshToken, secret_key);

        // Determine rememberMe based on the refresh token's age and expiry
        const SECONDS_IN_DAY = 24 * 60 * 60;
        const rememberMe = (decoded.exp - decoded.iat > SECONDS_IN_DAY);

        // 2. Hash refresh token and check if it exists in DB
        const hashRefreshToken = secureHash(oldRefreshToken);
        const tokenDoc = await refreshTokenModel.findOne({ token: hashRefreshToken });
        if (!tokenDoc) {
            throw new ApiError(403, 'Session expired or invalid. Please sign in again.');
        }

        // 3. Verify User exists
        const user = await userModel.findById(tokenDoc.userId);
        if (!user) {
            throw new ApiError(404, 'No account found with this email address.');
        }

        const familyId = tokenDoc.familyId;

        // 4. CHECK GRACE PERIOD: Has this token already been rotated?
        if (tokenDoc.isRotated) {
            const timeSinceRotation = now - new Date(tokenDoc.rotatedAt).getTime();
            if (timeSinceRotation <= GRACE_PERIOD_MS) {
                // Allowed! A concurrent request arrived right after rotation.
                return { user, rememberMe, isGracePeriod: true, familyId };
            } else {
                // If used AFTER 10 seconds, this is a REUSE ATTACK (stolen token)!
                await refreshTokenModel.deleteMany({ familyId });
                throw new ApiError(403, 'Compromised token detected. Please sign in again.');
            }
        }

        // 5. ATOMIC ROTATION:
        // Try to atomically claim rotation ONLY if isRotated is still false in DB!
        const rotatedTokenDoc = await refreshTokenModel.findOneAndUpdate(
            { _id: tokenDoc._id, isRotated: false },
            {
                $set: {
                    isRotated: true,
                    rotatedAt: now
                }
            },
            { new: true }
        );

        // If rotatedTokenDoc is null, another concurrent request rotated it in that exact millisecond!
        // We gracefully treat this request as within the grace period.
        if (!rotatedTokenDoc) {
            return { user, rememberMe, isGracePeriod: true, familyId };
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
        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            throw new ApiError(400, 'Invalid session ID format.');
        }

        const session = await refreshTokenModel.findOne({ _id: sessionId, userId });
        if (!session) {
            throw new ApiError(404, 'Session not found or already terminated.');
        }

        const targetFamilyId = (session.familyId || session._id).toString();
        let isCurrent = false;

        // Check if the session being revoked matches the current active session family
        if (currentRefreshToken && currentRefreshToken !== 'undefined') {
            const currentTokenHash = secureHash(currentRefreshToken);
            const currentDoc = await refreshTokenModel.findOne({ token: currentTokenHash }).select('familyId').lean();
            if (currentDoc) {
                const currentFamilyId = (currentDoc.familyId || currentDoc._id).toString();
                if (currentFamilyId === targetFamilyId) {
                    isCurrent = true;
                }
            } else if (session.token === currentTokenHash) {
                isCurrent = true;
            }
        }

        // Delete all tokens belonging to this session family
        await refreshTokenModel.deleteMany({ familyId: session.familyId || session._id });

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
    refreshToken,
    getSessions,
    revokeSession
};