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
import { safeRedis } from "../../db/redis.js";
import REDIS_KEYS from "../../config/redisKeys.js";
import { parseUserAgent } from "../../utils/device.utils.js";
import mongoose from "mongoose";

const login = async (email, password) => {
    try {

        // 1. Find User in MongoDB (Source of Truth for sensitive password hash)
        const user = await userModel.findOne({ email }).select('+password');
        if (!user) {
            throw new ApiError(401, 'Incorrect email or password. Please try again.');
        }

        const userIdStr = user._id.toString();

        // 2. Check Account Blocked
        let currentUser = user;
        if (currentUser.isBlocked) {
            if (currentUser.blockExpiresAt > Date.now()) {
                // Ensure Redis block bucket is synced
                await safeRedis.setJson(REDIS_KEYS.userBlock(userIdStr), {
                    isBlocked: true,
                    blockReason: user.blockReason,
                    blockedAt: user.blockedAt ? new Date(user.blockedAt).toISOString() : null,
                    blockExpiresAt: user.blockExpiresAt ? new Date(user.blockExpiresAt).getTime() : null
                });
                throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(currentUser.blockExpiresAt)} due to ${currentUser.blockReason}.`);
            }

            // Atomically unblock ONLY if isBlocked is still true in the database
            const [unblockedUser,] = await Promise.all([
                userModel.findOneAndUpdate(
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
                ).select('+password'),
                safeRedis.setJson(REDIS_KEYS.userBlock(userIdStr), {
                    isBlocked: false,
                    blockReason: null,
                    blockedAt: null,
                    blockExpiresAt: null
                })
            ]);

            currentUser = unblockedUser;
        }

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
            if (currentUser.otpCoolDown && currentUser.otpCoolDown > now && currentUser.otpExpiry > now) {

                // Sync OTP to Redis if not present
                const otpTtl = Math.ceil((currentUser.otpExpiry - now) / 1000);
                await safeRedis.setJson(REDIS_KEYS.userOtp(userIdStr), {
                    otp: currentUser.otp,
                    otpExpiry: currentUser.otpExpiry,
                    otpCoolDown: currentUser.otpCoolDown,
                    otpAttempts: currentUser.otpAttempts || 0
                }, otpTtl);
                return { user: currentUser, is2FAEnabled: true };
            }

            // Generate new OTP parameters
            const otp = generateOTP();
            const otpExpiry = now + CONSTANTS.OTP.EXPIRY_MS;
            const otpCoolDown = now + CONSTANTS.OTP.COOL_DOWN_MS;

            // Atomically update MongoDB only if cooldown is expired
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

            if (!updatedUser) {
                return { user: currentUser, is2FAEnabled: true };
            }

            // Sync new OTP state into Redis OTP Bucket (with expiry matching OTP lifetime)
            const otpTtlSeconds = Math.ceil(CONSTANTS.OTP.EXPIRY_MS / 1000);
            await safeRedis.setJson(REDIS_KEYS.userOtp(userIdStr), {
                otp,
                otpExpiry,
                otpCoolDown,
                otpAttempts: 0
            }, otpTtlSeconds);

            // Send email; if sending fails, roll back both DB and Redis OTP Bucket
            try {
                await sendOTPEmail(currentUser.email, otp);
            } catch (error) {
                await userModel.updateOne(
                    { _id: currentUser._id },
                    { $set: { otp: null, otpExpiry: null, otpCoolDown: null, otpAttempts: 0 } }
                );
                await safeRedis.del(REDIS_KEYS.userOtp(userIdStr));
                throw new ApiError(500, 'Unable to send verification code. Please try again.');
            }

            return { user: updatedUser, is2FAEnabled: true };
        }

        // 6. Update Last Login atomically in MongoDB & sync to Redis User Profile Bucket
        await userModel.updateOne(
            { _id: currentUser._id },
            { $set: { lastLogin: now } }
        );
        currentUser.lastLogin = now;

        // Keep lastLogin fresh in Redis Profile Bucket (stored as ISO string for audit/frontend)
        await safeRedis.setJson(REDIS_KEYS.userProfile(userIdStr), {
            _id: userIdStr,
            name: currentUser.name,
            email: currentUser.email,
            isVerified: currentUser.isVerified,
            lastLogin: new Date(now).toISOString(),
            tokenVersion: currentUser.tokenVersion,
            googleLogin: currentUser.googleLogin,
            settings: currentUser.settings,
            resetToken: currentUser.resetToken
        });

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
        } catch (error) {
            // Delete user if email fails to prevent deadlock (cleanup)
            await userModel.findByIdAndDelete(new_user._id);
            throw new ApiError(500, 'Unable to send verification email. Please try again in a few moments.');
        }

        // Email succeeded: Concurrently initialize Redis buckets and email-to-id mapping
        const userIdStr = new_user._id.toString();
        const otpTtlSeconds = Math.ceil(CONSTANTS.OTP.EXPIRY_MS / 1000);

        await Promise.all([
            // 1. Email-to-ID lookup
            safeRedis.set(REDIS_KEYS.emailToId(new_user.email), userIdStr),

            // 2. User Profile Bucket
            safeRedis.setJson(REDIS_KEYS.userProfile(userIdStr), {
                _id: userIdStr,
                name: new_user.name,
                email: new_user.email,
                isVerified: new_user.isVerified,
                lastLogin: null,
                tokenVersion: new_user.tokenVersion || 0,
                googleLogin: false,
                settings: new_user.settings || { alwaysRequireOtp: false },
                resetToken: null
            }),

            // 3. User Block Bucket (Initial clean state)
            safeRedis.setJson(REDIS_KEYS.userBlock(userIdStr), {
                isBlocked: false,
                blockReason: null,
                blockedAt: null,
                blockExpiresAt: null
            }),

            // 4. User OTP Bucket (with TTL)
            safeRedis.setJson(REDIS_KEYS.userOtp(userIdStr), {
                otp,
                otpExpiry: now + CONSTANTS.OTP.EXPIRY_MS,
                otpCoolDown: now + CONSTANTS.OTP.COOL_DOWN_MS,
                otpAttempts: 0
            }, otpTtlSeconds)
        ]);

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

                // Email succeeded: Concurrently initialize Redis buckets and email-to-id mapping
                const newUserIdStr = new_user._id.toString();
                const otpTtlSeconds = Math.ceil(CONSTANTS.OTP.EXPIRY_MS / 1000);

                await Promise.all([
                    safeRedis.set(REDIS_KEYS.emailToId(new_user.email), newUserIdStr),
                    safeRedis.setJson(REDIS_KEYS.userProfile(newUserIdStr), {
                        _id: newUserIdStr,
                        name: new_user.name,
                        email: new_user.email,
                        isVerified: new_user.isVerified,
                        lastLogin: null,
                        tokenVersion: new_user.tokenVersion || 0,
                        googleLogin: true,
                        settings: new_user.settings || { alwaysRequireOtp: false },
                        resetToken: null
                    }),
                    safeRedis.setJson(REDIS_KEYS.userBlock(newUserIdStr), {
                        isBlocked: false,
                        blockReason: null,
                        blockedAt: null,
                        blockExpiresAt: null
                    }),
                    safeRedis.setJson(REDIS_KEYS.userOtp(newUserIdStr), {
                        otp,
                        otpExpiry: Date.now() + CONSTANTS.OTP.EXPIRY_MS,
                        otpCoolDown: Date.now() + CONSTANTS.OTP.COOL_DOWN_MS,
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

        // Check Account Blocked
        let currentUser = user;
        const currentUserIdStr = currentUser._id.toString();

        if (currentUser.isBlocked) {
            if (currentUser.blockExpiresAt > now) {
                // Ensure Redis block bucket is synced
                await safeRedis.setJson(REDIS_KEYS.userBlock(currentUserIdStr), {
                    isBlocked: true,
                    blockReason: currentUser.blockReason,
                    blockedAt: currentUser.blockedAt ? new Date(currentUser.blockedAt).toISOString() : null,
                    blockExpiresAt: currentUser.blockExpiresAt ? new Date(currentUser.blockExpiresAt).getTime() : null
                });
                throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(currentUser.blockExpiresAt)} due to ${currentUser.blockReason}.`);
            }

            // Atomically unblock ONLY if isBlocked is still true in the database
            const [unblockedUser] = await Promise.all([
                userModel.findOneAndUpdate(
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
                ),
                safeRedis.setJson(REDIS_KEYS.userBlock(currentUserIdStr), {
                    isBlocked: false,
                    blockReason: null,
                    blockedAt: null,
                    blockExpiresAt: null
                })
            ]);

            if (unblockedUser) {
                currentUser = unblockedUser;
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

            // Sync new OTP state into Redis OTP Bucket (with expiry matching OTP lifetime)
            const otpTtlSeconds = Math.ceil(CONSTANTS.OTP.EXPIRY_MS / 1000);
            await safeRedis.setJson(REDIS_KEYS.userOtp(currentUserIdStr), {
                otp,
                otpExpiry,
                otpCoolDown,
                otpAttempts: 0
            }, otpTtlSeconds);

            // 4. Send email; if sending fails, roll back the OTP in DB and Redis
            try {
                const result = await sendOTPEmail(currentUser.email, otp);
                if (!result.success) throw new Error(result.error);
            } catch (error) {
                await userModel.updateOne(
                    { _id: currentUser._id },
                    { $set: { otp: null, otpExpiry: null, otpCoolDown: null, otpAttempts: 0 } }
                );
                await safeRedis.del(REDIS_KEYS.userOtp(currentUserIdStr));
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

        // Keep lastLogin fresh in Redis Profile Bucket
        await safeRedis.setJson(REDIS_KEYS.userProfile(currentUserIdStr), {
            _id: currentUserIdStr,
            name: currentUser.name,
            email: currentUser.email,
            isVerified: currentUser.isVerified,
            lastLogin: new Date(now).toISOString(),
            tokenVersion: currentUser.tokenVersion,
            googleLogin: currentUser.googleLogin,
            settings: currentUser.settings,
            resetToken: currentUser.resetToken
        });

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

        // 1. Invalidate Refresh Token Session Family if refreshToken exists
        if (refreshToken && refreshToken !== 'undefined') {
            try {
                const hashedRefreshToken = secureHash(refreshToken);
                const tokenDoc = await refreshTokenModel.findOne({ token: hashedRefreshToken });
                if (tokenDoc) {
                    const familyId = tokenDoc.familyId || tokenDoc._id;

                    await refreshTokenModel.deleteMany({ familyId });
                    await safeRedis.del(REDIS_KEYS.session(familyId.toString()));
                }
            } catch (err) {
                console.error('[Logout Session Revoke Error]:', err.message);
            }
        }

        // 2. Blacklist Access Token in Redis if provided (Fixed 10 minutes TTL)
        if (accessToken && accessToken !== 'undefined') {
            const hashedAccessToken = secureHash(accessToken);
            const ttl = CONSTANTS.AUTH_TOKEN.BLACKLIST_TOKEN;
            await safeRedis.set(REDIS_KEYS.blacklist(hashedAccessToken), '1', ttl);
        }

        return true;
    }
    catch (error) {
        throw error;
    }
}

const logoutAll = async (accessToken, refreshToken, authenticatedUserId = null, expectedTokenVersion = null) => {
    try {
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
            { new: true, select: { tokenVersion: 1 } }
        );

        // If a concurrent request already updated tokenVersion, exit early.
        // Do not touch Redis or delete any keys; controller will simply clear cookies and return 200.
        if (!updatedUserDoc) {
            return true;
        }

        const newTokenVersion = updatedUserDoc.tokenVersion;

        // 2. Fetch user's active session family IDs before deleting from MongoDB
        let sessionKeys = [];
        try {
            const activeSessions = await refreshTokenModel.find({ userId: userIdStr }).select({ familyId: 1 }).lean();
            sessionKeys = activeSessions
                .map(s => s.familyId ? REDIS_KEYS.session(s.familyId.toString()) : null)
                .filter(Boolean);
        } catch (err) {
            console.error('[LogoutAll Fetch Sessions Warning]:', err.message);
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
    }
    catch (error) {
        throw error;
    }
}

const sendOTP = async (email) => {
    try {
        const now = Date.now();

        // 1. Fast Path: Check Redis for existing cached userId
        const cachedUserId = await safeRedis.get(REDIS_KEYS.emailToId(email));
        if (cachedUserId) {
            // Check Redis Block Bucket
            const cachedBlock = await safeRedis.getJson(REDIS_KEYS.userBlock(cachedUserId));
            if (cachedBlock && cachedBlock.isBlocked) {
                if (cachedBlock.blockExpiresAt && cachedBlock.blockExpiresAt > now) {
                    throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(cachedBlock.blockExpiresAt)} due to ${cachedBlock.blockReason}.`);
                }
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
        if (user.isBlocked) {
            if (user.blockExpiresAt > now) {
                // Ensure Redis block bucket is synced
                await safeRedis.setJson(REDIS_KEYS.userBlock(userIdStr), {
                    isBlocked: true,
                    blockReason: user.blockReason,
                    blockedAt: user.blockedAt ? new Date(user.blockedAt).toISOString() : null,
                    blockExpiresAt: user.blockExpiresAt ? new Date(user.blockExpiresAt).getTime() : null
                });
                throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(user.blockExpiresAt)} due to ${user.blockReason}.`);
            }

            // Atomically unblock if expired
            const [unblockedUser] = await Promise.all([
                userModel.findOneAndUpdate(
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
                ),
                safeRedis.setJson(REDIS_KEYS.userBlock(userIdStr), {
                    isBlocked: false,
                    blockReason: null,
                    blockedAt: null,
                    blockExpiresAt: null
                })
            ]);

            if (unblockedUser) {
                user = unblockedUser;
            }
        }

        // 3. Generate OTP parameters
        const otp = generateOTP();
        const otpExpiry = now + CONSTANTS.OTP.EXPIRY_MS;
        const otpCoolDown = now + CONSTANTS.OTP.COOL_DOWN_MS;

        // Atomically update user in MongoDB ONLY if cooldown is null or has expired
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

        // 4. Save OTP to Redis with TTL matching OTP expiry
        const otpTtl = Math.ceil(CONSTANTS.OTP.EXPIRY_MS / 1000);
        await safeRedis.setJson(REDIS_KEYS.userOtp(userIdStr), {
            otp,
            otpExpiry,
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

        // 8. Revoke all active refresh token sessions for this user in DB (Source of Truth)
        await refreshTokenModel.deleteMany({ userId: user._id });

        // 9. Redis Cache Invalidation
        await safeRedis.del(REDIS_KEYS.userTokenVersion(user._id.toString()));

        return { user: updatedUser };
    }
    catch (error) {
        throw error;
    }
}

const verifyOTP = async (email, otp) => {
    try {
        let user = null;
        const now = Date.now();

        // 1. Check Redis for cached userId
        let userIdStr = await safeRedis.get(REDIS_KEYS.emailToId(email));
        let blockData = userIdStr ? await safeRedis.getJson(REDIS_KEYS.userBlock(userIdStr)) : null;
        let otpData = userIdStr ? await safeRedis.getJson(REDIS_KEYS.userOtp(userIdStr)) : null;

        // 2. SINGLE-READ FALLBACK:
        // If ANY key missed in Redis, fetch from MongoDB once and only once.
        if (!userIdStr || !blockData || !otpData) {
            user = await userModel.findOne({ email }).lean();
            if (!user) {
                throw new ApiError(404, 'No account found with this email address.');
            }
            userIdStr = user._id.toString();

            // Use in-memory MongoDB document for missing emailToId
            if (!userIdStr) {
                await safeRedis.set(REDIS_KEYS.emailToId(email), userIdStr);
            }

            // Use in-memory MongoDB document for missing block data
            if (!blockData) {
                blockData = {
                    isBlocked: Boolean(user.isBlocked),
                    blockReason: user.blockReason,
                    blockedAt: user.blockedAt ? new Date(user.blockedAt).toISOString() : null,
                    blockExpiresAt: user.blockExpiresAt ? new Date(user.blockExpiresAt).getTime() : null
                };
                // Self-heal block bucket
                await safeRedis.setJson(REDIS_KEYS.userBlock(userIdStr), blockData);
            }

            // Use in-memory MongoDB document for missing OTP data
            if (!otpData) {
                if (!user.otp) {
                    throw new ApiError(400, 'No active verification code found. Please request a new one.');
                }
                otpData = {
                    otp: user.otp,
                    otpExpiry: user.otpExpiry,
                    otpCoolDown: user.otpCoolDown,
                    otpAttempts: user.otpAttempts || 0
                };
            }
        }

        // 3. Validate Block Status
        if (blockData.isBlocked) {
            if (blockData.blockExpiresAt && blockData.blockExpiresAt > now) {
                throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(blockData.blockExpiresAt)} due to ${blockData.blockReason}.`);
            }

            // Unblock expired block in MongoDB and Redis
            const updatedUser = await userModel.updateOne(
                { _id: userIdStr, isBlocked: true },
                {
                    $set: {
                        isBlocked: false,
                        blockReason: null,
                        blockedAt: null,
                        blockExpiresAt: null
                    }
                },
                { new: true, lean: true }
            );

            if (updatedUser) {
                user = updatedUser; // Update in-memory user document
                await safeRedis.setJson(REDIS_KEYS.userBlock(userIdStr), {
                    isBlocked: false,
                    blockReason: null,
                    blockedAt: null,
                    blockExpiresAt: null
                });
            }
        }

        // 4. Check OTP Expiry 
        if (otpData.otpExpiry && otpData.otpExpiry < now) {
            const updatedUser = await userModel.updateOne(
                { _id: userIdStr },
                { $set: { otp: null, otpExpiry: null, otpCoolDown: null, otpAttempts: 0 } },
                { new: true, lean: true }
            );

            if (updatedUser) {
                user = updatedUser; // Update in-memory user document
                await safeRedis.setJson(REDIS_KEYS.userOtp(userIdStr), {
                    otp: null,
                    otpExpiry: null,
                    otpCoolDown: null,
                    otpAttempts: 0
                });
            }

            throw new ApiError(401, 'This verification code has expired. Please request a new one.');
        }

        // 5. Check Attempt Limit Before Testing Match
        if (otpData.otpAttempts >= 5) {
            throw new ApiError(403, 'Too many incorrect attempts. Please request a new verification code.');
        }

        // 6. Test OTP Match
        if (otpData.otp.toString() !== otp.toString()) {
            // Atomic increment of failed attempts directly in MongoDB to prevent concurrent bypass
            const failedAttemptUser = await userModel.findOneAndUpdate(
                { _id: userIdStr, otpAttempts: { $lt: 5 } },
                { $inc: { otpAttempts: 1 } },
                { new: true, select: { otpAttempts: 1, otpExpiry: 1 } }
            );

            const newAttempts = failedAttemptUser ? failedAttemptUser.otpAttempts : 5;

            // If 5th failed attempt reached, lock the account atomically in MongoDB & Redis
            if (newAttempts >= 5) {
                const blockExpiresAt = now + CONSTANTS.OTP.BLOCK_TIME_MS;
                const blockReason = 'Too many failed OTP attempts';

                await Promise.all([
                    userModel.updateOne(
                        { _id: userIdStr },
                        {
                            $set: {
                                otp: null,
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
                    safeRedis.setJson(REDIS_KEYS.userBlock(userIdStr), {
                        isBlocked: true,
                        blockReason,
                        blockedAt: new Date(now).toISOString(),
                        blockExpiresAt
                    }),
                    safeRedis.del(REDIS_KEYS.userOtp(userIdStr))
                ]);

                throw new ApiError(403, 'Too many incorrect attempts. Your account has been temporarily locked.');
            }

            // Sync incremented attempts to Redis
            const remainingTtl = otpData.otpExpiry ? Math.max(1, Math.ceil((otpData.otpExpiry - now) / 1000)) : 300;
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
        );

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
                lastLogin: new Date(now).toISOString(),
                tokenVersion: updatedUserDoc.tokenVersion || 0,
                googleLogin: Boolean(updatedUserDoc.googleLogin),
                settings: updatedUserDoc.settings || { alwaysRequireOtp: false },
                resetToken: updatedUserDoc.resetToken || null
            })
        ]);

        return { user: updatedUserDoc };
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
                await safeRedis.del(REDIS_KEYS.session(familyId.toString()));
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

        // Delete all tokens belonging to this session family and clear Redis session cache
        await refreshTokenModel.deleteMany({ familyId: session.familyId || session._id });
        await safeRedis.del(REDIS_KEYS.session(targetFamilyId));

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