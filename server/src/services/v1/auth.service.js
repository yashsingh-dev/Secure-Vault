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
import { safeRedis } from "../../db/redis.js";
import REDIS_KEYS from "../../config/redisKeys.js";
import { parseUserAgent } from "../../utils/device.utils.js";
import mongoose from "mongoose";
import { checkUserBlock } from "../../utils/authCore.utils.js";
import { logger } from "../../lib/logger.js";

const login = async (email, password) => {
    // 1. Find User in MongoDB (Source of Truth for sensitive password hash)
    const user = await userModel.findOne({ email }).select('+password').lean();
    if (!user) {
        throw new ApiError(401, 'Incorrect email or password. Please try again.');
    }

    const userIdStr = user._id.toString().trim();

    // 2. Check Account Blocked
    const currentUser = await checkUserBlock(userIdStr, user);

    // 3. Check if account is associated with Google
    if (currentUser.googleLogin) {
        throw new ApiError(403, 'This account was registered using Google. Please sign in with Google.');
    }

    // 4. Check Password
    const isMatch = await verifyHash(password, currentUser.password);
    if (!isMatch) {
        throw new ApiError(401, 'Incorrect email or password. Please try again.');
    }

    // 5. Check 2FA & Handle OTP Generation
    const now = Date.now();
    if (currentUser.settings.alwaysRequireOtp || !currentUser.isVerified) {

        // Check existing OTP cooldown directly from the authoritative in-memory document
        if (currentUser.otpCoolDown && currentUser.otpCoolDown > now) {

            // Sync OTP to Redis if not present
            const otpTtl = Math.ceil((new Date(currentUser.otpExpiry).getTime() - now) / 1000);
            await safeRedis.setJson(REDIS_KEYS.userOtp(userIdStr), {
                otp: currentUser.otp,
                otpCoolDown: new Date(currentUser.otpCoolDown).getTime(),
                otpAttempts: currentUser.otpAttempts || 0
            }, otpTtl);

            return { user: currentUser, is2FAEnabled: true };
        }

        // Generate new OTP parameters
        const otp = generateOTP();
        const otpExpiry = now + CONSTANTS.OTP.EXPIRY_MS;
        const otpCoolDown = now + CONSTANTS.OTP.COOL_DOWN_MS;

        // Atomically update MongoDB only if cooldown is expired
        const result = await userModel.updateOne(
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
            }
        );

        const isUpdated = result.modifiedCount > 0;

        if (!isUpdated) {
            return { user: currentUser, is2FAEnabled: true };
        }

        // Sync new OTP state into Redis OTP Bucket (with expiry matching OTP lifetime)
        const otpTtlSeconds = Math.ceil(CONSTANTS.OTP.EXPIRY_MS / 1000);
        await safeRedis.setJson(REDIS_KEYS.userOtp(userIdStr), {
            otp,
            otpCoolDown,
            otpAttempts: 0
        }, otpTtlSeconds);

        // Send email; if sending fails, roll back both DB and Redis OTP Bucket
        try {
            const result = await sendOTPEmail(currentUser.email, otp);
            if (!result.success) throw new Error(result.error);
        } catch (error) {
            await Promise.all([
                userModel.updateOne(
                    { _id: currentUser._id },
                    { $set: { otp: null, otpExpiry: null, otpCoolDown: null, otpAttempts: 0 } }
                ),
                safeRedis.del(REDIS_KEYS.userOtp(userIdStr))
            ]);
            throw new ApiError(500, 'Unable to send verification code. Please try again.');
        }

        return { user: currentUser, is2FAEnabled: true };
    }

    // 6. Update Last Login atomically in MongoDB & sync to Redis User Profile Bucket
    await Promise.all([
        userModel.updateOne(
            { _id: currentUser._id },
            { $set: { lastLogin: now } }
        ),
        safeRedis.set(REDIS_KEYS.emailToId(currentUser.email), userIdStr, CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000),
        safeRedis.setJson(REDIS_KEYS.userProfile(userIdStr), {
            _id: userIdStr,
            name: currentUser.name,
            email: currentUser.email,
            isVerified: currentUser.isVerified,
            lastLogin: now,
            tokenVersion: currentUser.tokenVersion,
            googleLogin: currentUser.googleLogin,
            settings: currentUser.settings
        }, CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000)
    ])
    currentUser.lastLogin = now;

    return { user: currentUser, is2FAEnabled: false };
};

const register = async (name, email, password) => {
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

    // Create User (code 11000 duplicate key handled by errorHandler middleware)
    const new_user = await userModel.create({
        name,
        email,
        password: hash_password,
        otp,
        otpExpiry: now + CONSTANTS.OTP.EXPIRY_MS,
        otpCoolDown: now + CONSTANTS.OTP.COOL_DOWN_MS,
        otpAttempts: 0,
    });

    // Send Email
    try {
        const result = await sendOTPEmail(new_user.email, otp);
        if (!result.success) throw new Error(result.error);
    } catch (error) {
        // Delete user if email fails to prevent deadlock (cleanup)
        await userModel.deleteOne({ _id: new_user._id });
        throw new ApiError(500, 'Unable to send verification email. Please try again in a few moments.');
    }

    // Email succeeded: Concurrently initialize Redis buckets and email-to-id mapping
    const userIdStr = new_user._id.toString();
    const otpTtlSeconds = Math.ceil(CONSTANTS.OTP.EXPIRY_MS / 1000);

    await Promise.all([
        // 1. Email-to-ID lookup
        safeRedis.set(REDIS_KEYS.emailToId(new_user.email), userIdStr, CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000),

        // 2. User Profile Bucket
        safeRedis.setJson(REDIS_KEYS.userProfile(userIdStr), {
            _id: userIdStr,
            name: new_user.name,
            email: new_user.email,
            isVerified: new_user.isVerified,
            lastLogin: now,
            tokenVersion: new_user.tokenVersion || 0,
            googleLogin: false,
            settings: new_user.settings || { alwaysRequireOtp: false }
        }, CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000),

        // 3. User Block Bucket (Initial clean state)
        safeRedis.del(REDIS_KEYS.userBlock(userIdStr)),

        // 4. User OTP Bucket (with TTL)
        safeRedis.setJson(REDIS_KEYS.userOtp(userIdStr), {
            otp,
            otpCoolDown: now + CONSTANTS.OTP.COOL_DOWN_MS,
            otpAttempts: 0
        }, otpTtlSeconds)
    ]);

    return { user: new_user };
};

const googleAuth = async (code) => {
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
    let user = await userModel.findOne({ email: userData.email }).lean();

    if (!user) {
        // Generate OTP
        const otp = generateOTP();

        // Create User (code 11000 duplicate key handled by errorHandler middleware)
        const new_user = await userModel.create({
            name: userData.name,
            email: userData.email,
            otp,
            otpExpiry: now + CONSTANTS.OTP.EXPIRY_MS,
            otpCoolDown: now + CONSTANTS.OTP.COOL_DOWN_MS,
            otpAttempts: 0,
            googleLogin: true
        });

        if (new_user) {
            // Send Email
            try {
                const result = await sendOTPEmail(new_user.email, otp);
                if (!result.success) throw new Error(result.error);
            } catch (error) {
                // Delete user if email fails to prevent deadlock (cleanup)
                await userModel.deleteOne({ _id: new_user._id });
                throw new ApiError(500, 'Unable to send verification email. Please try again in a few moments.');
            }

            // Email succeeded: Concurrently initialize Redis buckets and email-to-id mapping
            const newUserIdStr = new_user._id.toString();
            const otpTtlSeconds = Math.ceil(CONSTANTS.OTP.EXPIRY_MS / 1000);

            await Promise.all([
                // 1. Email-to-ID lookup
                safeRedis.set(REDIS_KEYS.emailToId(new_user.email), newUserIdStr, CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000),

                // 2. User Profile Bucket
                safeRedis.setJson(REDIS_KEYS.userProfile(newUserIdStr), {
                    _id: newUserIdStr,
                    name: new_user.name,
                    email: new_user.email,
                    isVerified: new_user.isVerified,
                    lastLogin: now,
                    tokenVersion: new_user.tokenVersion || 0,
                    googleLogin: true,
                    settings: new_user.settings || { alwaysRequireOtp: false }
                }, CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000),

                // 3. User Block Bucket (Initial clean state)
                safeRedis.del(REDIS_KEYS.userBlock(newUserIdStr)),

                // 4. User OTP Bucket (with TTL)
                safeRedis.setJson(REDIS_KEYS.userOtp(newUserIdStr), {
                    otp,
                    otpCoolDown: now + CONSTANTS.OTP.COOL_DOWN_MS,
                    otpAttempts: 0
                }, otpTtlSeconds)
            ]);

            return {
                user: new_user,
                is2FAEnabled: true,
                rememberMe: true
            };
        }
    }

    const userIdStr = user._id.toString().trim();

    // Check Account Blocked
    const currentUser = await checkUserBlock(userIdStr, user);

    // Check 2FA
    if (currentUser.settings.alwaysRequireOtp || !currentUser.isVerified) {
        // Check existing OTP cooldown directly from the authoritative in-memory document
        if (currentUser.otpCoolDown && currentUser.otpCoolDown > now) {
            // Sync OTP to Redis if not present
            const otpTtl = Math.ceil((new Date(currentUser.otpExpiry).getTime() - now) / 1000);
            await safeRedis.setJson(REDIS_KEYS.userOtp(userIdStr), {
                otp: currentUser.otp,
                otpCoolDown: new Date(currentUser.otpCoolDown).getTime(),
                otpAttempts: currentUser.otpAttempts || 0
            }, otpTtl);

            return { user: currentUser, is2FAEnabled: true };
        }

        // Generate new OTP parameters
        const otp = generateOTP();
        const otpExpiry = now + CONSTANTS.OTP.EXPIRY_MS;
        const otpCoolDown = now + CONSTANTS.OTP.COOL_DOWN_MS;

        // Atomically update the database only if cooldown is expired
        const result = await userModel.updateOne(
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

        const isUpdated = result.modifiedCount > 0;

        if (!isUpdated) {
            return { user: currentUser, is2FAEnabled: true };
        }

        // Sync new OTP state into Redis OTP Bucket (with expiry matching OTP lifetime)
        const otpTtlSeconds = Math.ceil(CONSTANTS.OTP.EXPIRY_MS / 1000);
        await safeRedis.setJson(REDIS_KEYS.userOtp(userIdStr), {
            otp,
            otpCoolDown,
            otpAttempts: 0
        }, otpTtlSeconds);

        // Send email; if sending fails, roll back the OTP in DB and Redis
        try {
            const result = await sendOTPEmail(currentUser.email, otp);
            if (!result.success) throw new Error(result.error);
        } catch (error) {
            await userModel.updateOne(
                { _id: currentUser._id },
                { $set: { otp: null, otpExpiry: null, otpCoolDown: null, otpAttempts: 0 } }
            );
            await safeRedis.del(REDIS_KEYS.userOtp(userIdStr));
            throw new ApiError(500, 'Unable to send verification code. Please try again.');
        }

        return { user: currentUser, is2FAEnabled: true };
    }

    // Update lastLogin atomically without relying on in-memory .save()
    await userModel.updateOne(
        { _id: currentUser._id },
        { $set: { lastLogin: now } }
    );
    currentUser.lastLogin = now;

    // Keep lastLogin fresh in Redis Profile Bucket
    await safeRedis.setJson(REDIS_KEYS.userProfile(userIdStr), {
        _id: userIdStr,
        name: currentUser.name,
        email: currentUser.email,
        isVerified: currentUser.isVerified,
        lastLogin: now,
        tokenVersion: currentUser.tokenVersion,
        googleLogin: currentUser.googleLogin,
        settings: currentUser.settings
    }, CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000);

    return {
        user: currentUser,
        is2FAEnabled: false,
        rememberMe: true
    };
};

const logout = async (accessToken, refreshToken) => {
    // 1. Invalidate Refresh Token Session Family if refreshToken exists
    if (refreshToken && refreshToken !== 'undefined') {
        try {
            const hashedRefreshToken = secureHash(refreshToken);
            const tokenDoc = await refreshTokenModel.findOne({ token: hashedRefreshToken }).select({ familyId: 1, _id: 0 }).lean();
            if (tokenDoc) {
                const targetFamilyId = tokenDoc.familyId;

                await refreshTokenModel.deleteMany({ familyId: targetFamilyId });
                await safeRedis.del(REDIS_KEYS.session(targetFamilyId.toString()));
            }
        } catch (err) {
            logger.warn({ err: err.message }, 'Failed to revoke refresh token session during logout');
        }
    }

    // 2. Blacklist Access Token in Redis if provided (Fixed 10 minutes TTL)
    if (accessToken && accessToken !== 'undefined') {
        const hashedAccessToken = secureHash(accessToken);
        const ttl = CONSTANTS.AUTH_TOKEN.BLACKLIST_TOKEN;
        await safeRedis.set(REDIS_KEYS.blacklist(hashedAccessToken), '1', ttl);
    }

    return true;
};

const logoutAll = async (accessToken, refreshToken, authenticatedUserId = null, expectedTokenVersion = null) => {
    const userIdStr = authenticatedUserId ? authenticatedUserId.toString() : null;
    if (!userIdStr) {
        return true;
    }

    // 1. Optimistic Concurrency Control (CAS):
    // Only increment tokenVersion if it matches expectedTokenVersion.
    const updateQuery = { _id: userIdStr };
    if (expectedTokenVersion !== null && expectedTokenVersion !== undefined) {
        updateQuery.tokenVersion = expectedTokenVersion;
    }

    const updatedUserDoc = await userModel.findOneAndUpdate(
        updateQuery,
        { $inc: { tokenVersion: 1 } },
        { new: true, projection: { _id: 0, tokenVersion: 1 } }
    ).lean();

    // If a concurrent request already updated tokenVersion, exit early.
    if (!updatedUserDoc) {
        return true;
    }

    const newTokenVersion = updatedUserDoc.tokenVersion;

    // 2. Fetch user's active session family IDs before deleting from MongoDB
    let sessionKeys = [];
    try {
        const activeSessions = await refreshTokenModel.find({ userId: userIdStr }).select({ familyId: 1, _id: 0 }).lean();
        sessionKeys = [
            ...new Set(
                activeSessions
                    .map(s => s.familyId ? REDIS_KEYS.session(s.familyId.toString()) : null)
                    .filter(Boolean)
            )
        ];
    } catch (err) {
        logger.warn({ userId: userIdStr, err: err.message }, 'Failed to fetch active sessions during logout-all operation');
    }

    // 3. Delete all sessions in MongoDB, sync Redis userProfile, and delete session keys
    await Promise.all([
        refreshTokenModel.deleteMany({ userId: userIdStr }),
        sessionKeys.length > 0 ? safeRedis.del(...sessionKeys) : Promise.resolve(),
        safeRedis.updateUserProfile(userIdStr, { tokenVersion: newTokenVersion })
    ]);

    // 4. Blacklist current access token in Redis (Fixed 10 minutes TTL)
    if (accessToken && accessToken !== 'undefined') {
        const hashAccessToken = secureHash(accessToken);
        const ttl = CONSTANTS.AUTH_TOKEN.BLACKLIST_TOKEN;
        await safeRedis.set(REDIS_KEYS.blacklist(hashAccessToken), '1', ttl);
    }

    return true;
};

const sendOTP = async (email) => {
    const now = Date.now();

    // 1. Fast Path: Check Redis for existing cached userId
    const cachedUserId = await safeRedis.get(REDIS_KEYS.emailToId(email));
    if (cachedUserId) {
        // Check Redis Block Bucket
        const blockReason = await safeRedis.get(REDIS_KEYS.userBlock(cachedUserId));
        if (blockReason) {
            throw new ApiError(403, `Your account is temporarily locked due to ${blockReason}.`);
        }

        // Check Redis OTP Bucket for active cooldown (Deflects spam before touching MongoDB)
        const cachedOtp = await safeRedis.getJson(REDIS_KEYS.userOtp(cachedUserId));
        if (cachedOtp && cachedOtp.otpCoolDown && cachedOtp.otpCoolDown > now) {
            throw new ApiError(429, 'Please wait before requesting another verification code.');
        }
    }

    // 2. Fetch User from MongoDB
    let user = await userModel.findOne({ email }).lean();
    if (!user) {
        throw new ApiError(404, 'No account found with this email address.');
    }

    const userIdStr = user._id.toString();

    // Sync user id to redis only if 
    if (cachedUserId !== userIdStr) await safeRedis.set(REDIS_KEYS.emailToId(email), userIdStr, CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000)

    // Check Account Blocked in MongoDB
    await checkUserBlock(userIdStr, user);

    // 3. Generate OTP parameters
    const otp = generateOTP();
    const otpExpiry = now + CONSTANTS.OTP.EXPIRY_MS;
    const otpCoolDown = now + CONSTANTS.OTP.COOL_DOWN_MS;

    // Atomically update user in MongoDB ONLY if cooldown is null or has expired
    const result = await userModel.updateOne(
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
    );

    const isUpdated = result.modifiedCount > 0;

    // Concurrent request
    if (!isUpdated) {
        return { user };
    }

    // 4. Save OTP to Redis with TTL matching OTP expiry
    const otpTtl = Math.ceil(CONSTANTS.OTP.EXPIRY_MS / 1000);
    await safeRedis.setJson(REDIS_KEYS.userOtp(userIdStr), {
        otp,
        otpCoolDown,
        otpAttempts: 0
    }, otpTtl);

    // 5. Send Email with dual-rollback on failure (MongoDB + Redis)
    try {
        const result = await sendOTPEmail(email, otp);
        if (result && !result.success) throw new Error(result.error);
    } catch (error) {
        // Dual Rollback: Wipe OTP from MongoDB and delete from Redis
        await Promise.all([
            userModel.updateOne(
                { _id: user._id },
                { $set: { otp: null, otpExpiry: null, otpCoolDown: null, otpAttempts: 0 } }
            ),
            safeRedis.del(REDIS_KEYS.userOtp(userIdStr))
        ]);
        throw new ApiError(500, 'Unable to send verification code. Please try again.');
    }

    return { user };
};

const resetPassword = async (email, password, token) => {
    let user = null;
    const now = Date.now();

    // 1. Fetch userId: Check Redis first, fallback to MongoDB
    let userIdStr = await safeRedis.get(REDIS_KEYS.emailToId(email));

    // Fetch Block bucket and Standalone Reset Token from Redis in parallel if userId is known
    let [blockReason, cachedResetToken] = userIdStr
        ? await Promise.all([
            safeRedis.getJson(REDIS_KEYS.userBlock(userIdStr)),
            safeRedis.get(REDIS_KEYS.userResetToken(userIdStr))
        ])
        : [null, null];

    // Fast lookup from redis if user is blocked or not
    if (blockReason) {
        throw new ApiError(403, `Your account has been blocked due to ${blockReason}. Please contact support for assistance.`);
    }

    // 2. If ANY key missed in Redis, fetch from MongoDB once and only once.
    if (!userIdStr || !cachedResetToken) {
        logger.debug({ email, missingUserId: !userIdStr, missingResetToken: !cachedResetToken }, 'Cache miss during password reset; falling back to MongoDB');
        user = await userModel.findOne({ email }).lean();
        if (!user) {
            throw new ApiError(404, 'No account found with this email address.');
        }

        if (!userIdStr) {
            userIdStr = user._id.toString();
            await safeRedis.set(REDIS_KEYS.emailToId(email), userIdStr, CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000);
        }

        // Use in-memory MongoDB document for missing block data
        if (user.isBlocked && user.blockExpiresAt > now) {
            const ttlSeconds = Math.max(1, Math.ceil((new Date(user.blockExpiresAt).getTime() - now) / 1000));
            await safeRedis.set(REDIS_KEYS.userBlock(userIdStr), user.blockReason || 'Security policy violation', ttlSeconds);
            throw new ApiError(403, `Your account has been blocked due to ${user.blockReason}. Please contact support for assistance.`);
        }

        // Populate missing reset token from in-memory user document
        if (!cachedResetToken) {
            cachedResetToken = user.resetToken;
            if (cachedResetToken) {
                const ttl = Math.floor(CONSTANTS.RESET_TOKEN.EXPIRY_MS / 1000);
                await safeRedis.set(REDIS_KEYS.userResetToken(userIdStr), cachedResetToken, ttl);
            } else {
                await safeRedis.del(REDIS_KEYS.userResetToken(userIdStr));
                throw new ApiError(403, 'Invalid or expired reset token.');
            }
        }
    }

    // 3. Check if Google Auth
    let isGoogleLogin = false;
    if (user) {
        isGoogleLogin = Boolean(user.googleLogin);
    } else {
        const cachedProfile = await safeRedis.getJson(REDIS_KEYS.userProfile(userIdStr));
        if (cachedProfile) {
            isGoogleLogin = Boolean(cachedProfile.googleLogin);
        } else {
            // Fetch just googleLogin if neither RAM nor Redis had profile
            const freshDoc = await userModel.findById(userIdStr).select({ googleLogin: 1, _id: 0 }).lean();
            isGoogleLogin = Boolean(freshDoc?.googleLogin);
        }
    }
    if (isGoogleLogin) {
        throw new ApiError(403, 'This account was registered using Google. Please sign in with Google.');
    }

    // 4. Verify Token Cryptographically with JWT
    const secret_key = process.env.JWT_RESET_KEY || 'default-key';
    let decoded;
    try {
        decoded = jwt.verify(token, secret_key);
    } catch (jwtError) {
        // If token expired, clean up both MongoDB and Redis
        await Promise.all([
            userModel.updateOne({ _id: userIdStr, resetToken: token }, { $set: { resetToken: null, resetTokenExpiry: null } }),
            safeRedis.del(REDIS_KEYS.userResetToken(userIdStr))
        ]);
        throw new ApiError(401, 'This password reset link has expired or is invalid.');
    }

    if (decoded._id !== userIdStr) {
        throw new ApiError(401, 'Invalid or expired password reset link.');
    }

    // 5. Check Token Match against Redis / Document
    if (!cachedResetToken || cachedResetToken !== token) {
        throw new ApiError(401, 'Invalid or expired password reset link.');
    }

    // 6. Encrypt New Password
    const hash_password = await createHash(password);

    // 8. Fetch active sessions to invalidate from Redis before deleting from DB
    let sessionKeys = [];
    try {
        const activeSessions = await refreshTokenModel.find({ userId: userIdStr }).select({ familyId: 1, _id: 0 }).lean();
        sessionKeys = [
            ...new Set(
                activeSessions
                    .map(s => s.familyId ? REDIS_KEYS.session(s.familyId.toString()) : null)
                    .filter(Boolean)
            )
        ];
    } catch (err) {
        logger.warn({ userId: userIdStr, err: err.message }, 'Failed to fetch active sessions during password reset session invalidation');
    }

    // 9. Atomic "Claim & Burn" Update:
    // Guarantees strict single-use even if concurrent requests arrive.
    const [updatedUser] = await Promise.all([
        userModel.findOneAndUpdate(
            {
                _id: userIdStr,
                resetToken: token
            },
            {
                $set: {
                    password: hash_password,
                    resetToken: null,
                    resetTokenExpiry: null
                },
                $inc: { tokenVersion: 1 }
            },
            { new: true, projection: { email: 1, tokenVersion: 1 } }
        ).lean(),

        refreshTokenModel.deleteMany({ userId: userIdStr })
    ]);

    if (!updatedUser) {
        throw new ApiError(401, 'This password reset link has already been used or expired.');
    }

    // 10. Concurrently clean Redis: Delete standalone resetToken, purge all sessions, and update userProfile
    await Promise.all([
        safeRedis.del(REDIS_KEYS.userResetToken(userIdStr)),
        sessionKeys.length > 0 ? safeRedis.del(...sessionKeys) : Promise.resolve(),
        safeRedis.updateUserProfile(userIdStr, { tokenVersion: updatedUser.tokenVersion })
    ]);

    return { user: updatedUser };
};

const verifyOTP = async (email, otp) => {
    let user = null;
    const now = Date.now();

    // 1. Check Redis for cached userId
    let userIdStr = await safeRedis.get(REDIS_KEYS.emailToId(email));

    // Concurrently fetch Block and OTP buckets in Redis
    let [blockReason, otpData] = userIdStr
        ? await Promise.all([
            safeRedis.get(REDIS_KEYS.userBlock(userIdStr)),
            safeRedis.getJson(REDIS_KEYS.userOtp(userIdStr))
        ])
        : [null, null];

    // Fast lookup from redis if user is blocked or not
    if (blockReason) {
        throw new ApiError(403, `Your account has been blocked due to ${blockReason}. Please contact support for assistance.`);
    }

    // Fast lookup from redis if OTP is expired or not
    if (!otpData) {
        throw new ApiError(401, 'Your verification code has expired. Please request a new one.');
    }

    // 2. If user id key missed in Redis, fetch from MongoDB once and only once.
    if (!userIdStr) {
        logger.debug({ email }, 'Cache miss for emailToId during OTP verification; falling back to MongoDB');
        user = await userModel.findOne({ email }).lean();
        if (!user) {
            throw new ApiError(404, 'No account found with this email address.');
        }

        // Use in-memory MongoDB document for missing emailToId
        if (!userIdStr) {
            userIdStr = user._id.toString();
            await safeRedis.set(REDIS_KEYS.emailToId(email), userIdStr, CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000);
        }

        // Use in-memory MongoDB document for missing block data
        if (user.isBlocked && user.blockExpiresAt > now) {
            const ttlSeconds = Math.max(1, Math.ceil((new Date(user.blockExpiresAt).getTime() - now) / 1000));
            await safeRedis.set(REDIS_KEYS.userBlock(userIdStr), user.blockReason || 'Security policy violation', ttlSeconds);
            throw new ApiError(403, `Your account has been blocked due to ${user.blockReason}. Please contact support for assistance.`);
        }

        // Use in-memory MongoDB document for missing OTP data
        if (user.otp) {
            if (user.otpExpiry < now) {

                await userModel.updateOne(
                    { _id: user._id, otp: user.otp },
                    { $set: { otp: null, otpExpiry: null, otpCoolDown: null, otpAttempts: 0 } }
                );

                await safeRedis.del(REDIS_KEYS.userOtp(userIdStr));
                throw new ApiError(401, 'Your verification code has expired. Please request a new one.');
            }

            const ttlSeconds = Math.max(1, Math.ceil((new Date(user.otpExpiry).getTime() - now) / 1000));
            await safeRedis.setJson(REDIS_KEYS.userOtp(userIdStr), {
                otp: user.otp,
                otpCoolDown: new Date(user.otpCoolDown).getTime(),
                otpAttempts: user.otpAttempts || 0
            }, ttlSeconds);

            // Update in-memory OTP data
            otpData = {
                otp: user.otp,
                otpCoolDown: new Date(user.otpCoolDown).getTime(),
                otpAttempts: user.otpAttempts || 0
            };
        }
        else {
            await safeRedis.del(REDIS_KEYS.userOtp(userIdStr));
            throw new ApiError(400, 'No active verification code found. Please request a new one.');
        }
    }

    // 3. Check Attempt Limit Before Testing Match
    if (otpData.otpAttempts >= 5) {
        throw new ApiError(403, 'Too many incorrect attempts. Please request a new verification code.');
    }

    // 4. Test OTP Match
    if (otpData.otp.toString() !== otp.toString()) {
        const currentAttempts = Number(otpData.otpAttempts || 0);

        // Optimistic Concurrency Control
        const failedAttemptUser = await userModel.findOneAndUpdate(
            { _id: userIdStr, otpAttempts: currentAttempts },
            { $inc: { otpAttempts: 1 } },
            { new: true, projection: { otpAttempts: 1 } }
        ).lean();

        // A concurrent request already incremented otpAttempts.
        if (!failedAttemptUser) {
            throw new ApiError(401, 'Incorrect verification code. Please check and try again.');
        }

        const newAttempts = failedAttemptUser.otpAttempts; // [This will be 4 -> 5]

        // If last failed attempt reached, lock the account atomically in MongoDB & Redis
        if (newAttempts >= CONSTANTS.OTP.MAX_ATTEMPTS) {
            const blockExpiresAt = now + CONSTANTS.OTP.BLOCK_TIME_MS;
            const blockReason = 'Too many failed OTP attempts';

            await Promise.all([
                userModel.updateOne(
                    { _id: userIdStr },
                    {
                        $set: {
                            otp,
                            otpExpiry: null,
                            otpCoolDown: null,
                            otpAttempts: 0,
                            isBlocked: true,
                            blockReason,
                            blockedAt: now,
                            blockExpiresAt
                        }
                    }
                ),
                safeRedis.set(REDIS_KEYS.userBlock(userIdStr), blockReason, Math.ceil((blockExpiresAt - now) / 1000)),
                safeRedis.del(REDIS_KEYS.userOtp(userIdStr))
            ]);

            logger.warn({ userId: userIdStr, blockReason, blockExpiresAt: new Date(blockExpiresAt).toISOString() }, 'Account temporarily locked due to excessive failed OTP attempts');

            throw new ApiError(403, 'Too many incorrect attempts. Your account has been temporarily locked.');
        }

        // Sync incremented attempts to Redis
        const remainingTtl = otpData.otpExpiry ? Math.max(1, Math.ceil((otpData.otpExpiry - now) / 1000)) : CONSTANTS.OTP.EXPIRY_MS / 1000;
        await safeRedis.setJson(REDIS_KEYS.userOtp(userIdStr), {
            ...otpData,
            otpAttempts: newAttempts
        }, remainingTtl);

        throw new ApiError(401, 'Incorrect verification code. Please check and try again.');
    }

    // 8. ATOMIC CLAIM & BURN:
    // Ensures only ONE concurrent request can successfully claim this OTP.
    // Guarantees zero race conditions even under concurrent request spam.
    const updatedUserDoc = await userModel.findOneAndUpdate(
        {
            _id: userIdStr,
            otp: otp.toString(),
            otpExpiry: { $gte: now }
        },
        {
            $set: {
                isVerified: true,
                otp: null,
                otpExpiry: null,
                otpCoolDown: null,
                otpAttempts: 0,
                lastLogin: now
            }
        },
        { new: true }
    ).lean();

    // If updatedUserDoc is null, another concurrent request already verified and burned the OTP
    if (!updatedUserDoc) {
        throw new ApiError(401, 'Verification code has already been used or expired.');
    }

    // 9. Concurrently clean OTP bucket & update User Profile Bucket in Redis
    await Promise.all([
        safeRedis.del(REDIS_KEYS.userOtp(userIdStr)),
        safeRedis.setJson(REDIS_KEYS.userProfile(userIdStr), {
            _id: userIdStr,
            name: updatedUserDoc.name,
            email: updatedUserDoc.email,
            isVerified: true,
            lastLogin: now,
            tokenVersion: updatedUserDoc.tokenVersion || 0,
            googleLogin: Boolean(updatedUserDoc.googleLogin),
            settings: updatedUserDoc.settings || { alwaysRequireOtp: false }
        }, CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000)
    ]);

    return { user: updatedUserDoc };
};

const refreshToken = async (oldRefreshToken) => {
    const now = Date.now();
    const GRACE_PERIOD_MS = 15 * 1000; // 15 seconds grace period

    // 1. Verify refresh token cryptographic validity first
    const secret_key = process.env.JWT_REFRESH_KEY || 'default-key';
    const decoded = jwt.verify(oldRefreshToken, secret_key);

    // Determine rememberMe based on the refresh token's age and expiry
    const SECONDS_IN_DAY = CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS / 1000;
    const rememberMe = (decoded.exp - decoded.iat > SECONDS_IN_DAY);

    // 2. Hash refresh token and check if it exists in DB
    const hashRefreshToken = secureHash(oldRefreshToken);
    const tokenDoc = await refreshTokenModel.findOne({ token: hashRefreshToken }).lean();
    if (!tokenDoc) {
        throw new ApiError(403, 'Session expired or invalid. Please sign in again.');
    }

    // 3. Verify User exists & Check Block Status
    let user = await userModel.findById(tokenDoc.userId).select('isBlocked blockReason blockExpiresAt tokenVersion').lean();
    if (!user) {
        throw new ApiError(404, 'No account found with this email address.');
    }

    // Check block status 
    await checkUserBlock(user._id.toString(), user);

    const familyId = tokenDoc.familyId;

    // 4. CHECK GRACE PERIOD: Has this token already been rotated?
    if (tokenDoc.isRotated) {
        const timeSinceRotation = now - new Date(tokenDoc.rotatedAt).getTime();
        if (timeSinceRotation <= GRACE_PERIOD_MS) {
            // Allowed! A concurrent request arrived right after rotation.
            return { user, rememberMe, isGracePeriod: true, familyId };
        } else {
            // If used AFTER GRACE PERIOD, this is a REUSE ATTACK (stolen token)!
            logger.warn({ userId: user._id, familyId: familyId.toString() }, 'Compromised refresh token reuse detected! Revoking entire session family');
            await refreshTokenModel.deleteMany({ familyId });
            await safeRedis.del(REDIS_KEYS.session(familyId.toString()));
            throw new ApiError(403, 'Compromised token detected. Please sign in again.');
        }
    }

    // 5. ATOMIC ROTATION:
    // Try to atomically claim rotation ONLY if isRotated is still false in DB!
    const result = await refreshTokenModel.updateOne(
        { _id: tokenDoc._id, isRotated: false },
        {
            $set: {
                isRotated: true,
                rotatedAt: now
            }
        }
    );

    const isUpdated = result.modifiedCount > 0;

    // Concurrent request rotated it in that exact millisecond!
    // We gracefully treat this request as within the grace period.
    if (!isUpdated) {
        return { user, rememberMe, isGracePeriod: true, familyId };
    }

    return { user, rememberMe, isGracePeriod: false, familyId };
};

const getSessions = async (userId, currentRefreshToken) => {
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
    }).sort({ lastActive: -1 }).lean();

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
            familyId: doc.familyId.toString(),
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
};

const revokeSession = async (userId, sessionId, currentAccessToken, currentRefreshToken) => {
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        throw new ApiError(400, 'Invalid session ID format.');
    }

    const session = await refreshTokenModel.findOne({ _id: sessionId, userId }).select('familyId token').lean();
    if (!session) {
        throw new ApiError(404, 'Session not found or already terminated.');
    }

    const targetFamilyId = (session.familyId).toString();
    let isCurrent = false;

    // Check if the session being revoked matches the current active session family
    if (currentRefreshToken && currentRefreshToken !== 'undefined') {
        const currentTokenHash = secureHash(currentRefreshToken);
        if (session.token === currentTokenHash) {
            isCurrent = true;
        }
    }

    // Delete all tokens belonging to this session family and clear Redis session cache
    await refreshTokenModel.deleteMany({ familyId: session.familyId });
    await safeRedis.del(REDIS_KEYS.session(targetFamilyId));

    // Add the access token in blacklist
    const hashAccessToken = secureHash(currentAccessToken);
    const tokenTtl = Math.floor(CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN_MS / 1000);
    await safeRedis.set(REDIS_KEYS.blacklist(hashAccessToken), '1', tokenTtl);

    return { isCurrent };
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