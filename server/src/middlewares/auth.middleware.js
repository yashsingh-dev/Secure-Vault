import jwt from 'jsonwebtoken';
import refreshTokenModel from "../models/refreshToken.model.js";
import ApiError from '../utils/ApiError.js';
import secureHash from "../utils/crypto.utils.js";
import userModel from '../models/user.model.js';
import { clearToken, clearTokenCookies, getAccessToken } from '../utils/setCookies.utils.js';
import { safeRedis } from '../db/redis.js';
import { CONSTANTS } from '../config/constants.js';
import REDIS_KEYS from '../config/redisKeys.js';
import { logger } from '../lib/logger.js';

export const authenticate = async (req, res, next) => {
    try {

        // Check Access Token
        const accessToken = getAccessToken(req);
        if (!accessToken || accessToken === 'undefined') {
            throw new ApiError(401, 'Access Token Missing');
        }

        // Verify JWT Signature and expiry
        const secret_key = process.env.JWT_ACCESS_KEY || 'default-key';
        let decoded = jwt.verify(accessToken, secret_key);

        // 1. Blacklist Check
        const hashAccessToken = secureHash(accessToken);
        const isBlacklisted = await safeRedis.exists(REDIS_KEYS.blacklist(hashAccessToken));
        if (isBlacklisted) {
            clearToken(res, CONSTANTS.NAME.ACCESS_TOKEN);
            throw new ApiError(403, 'Session has been revoked. Please sign in again.');
        }

        // 2. Token Version Check (Redis userProfile bucket -> MongoDB Fallback)
        let activeTokenVersion = null;
        const cachedProfile = await safeRedis.getJson(REDIS_KEYS.userProfile(decoded._id));
        if (cachedProfile && cachedProfile.tokenVersion !== undefined && cachedProfile.tokenVersion !== null) {
            activeTokenVersion = parseInt(cachedProfile.tokenVersion, 10);
        } else {
            // Fallback: Query MongoDB if Redis missed or profile had no tokenVersion
            logger.warn({ userId: decoded._id }, 'Redis profile cache miss; falling back to MongoDB');
            const userData = await userModel.findById(decoded._id).select({
                name: 1, email: 1, isVerified: 1, lastLogin: 1, tokenVersion: 1, googleLogin: 1, settings: 1
            }).lean();

            if (!userData) {
                clearTokenCookies(res);
                throw new ApiError(409, 'User account no longer exists.');
            }
            activeTokenVersion = userData.tokenVersion;

            // Self-heal userProfile cache in Redis
            await safeRedis.setJson(REDIS_KEYS.userProfile(decoded._id), {
                _id: userData._id.toString(),
                name: userData.name,
                email: userData.email,
                isVerified: userData.isVerified,
                lastLogin: userData.lastLogin ? new Date(userData.lastLogin).toISOString() : null,
                tokenVersion: userData.tokenVersion,
                googleLogin: userData.googleLogin,
                settings: userData.settings
            }, CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000);
            logger.debug({ userId: decoded._id }, 'Self-healed Redis user profile cache from MongoDB');
        }

        if (activeTokenVersion !== decoded.tokenVersion) {
            logger.warn({ userId: decoded._id, activeTokenVersion, tokenVersion: decoded.tokenVersion }, 'Token version mismatch detected; terminating session');
            clearTokenCookies(res);
            throw new ApiError(401, 'Session has ended. Please sign in again.');
        }

        // 3. Active Session Family Check (Redis -> MongoDB Fallback)
        let isSessionActive = true;
        if (decoded.familyId) {
            isSessionActive = await safeRedis.exists(REDIS_KEYS.session(decoded.familyId));
            if (!isSessionActive) {
                // Fallback: Query MongoDB if Redis reported false/offline
                logger.warn({ familyId: decoded.familyId }, 'Redis session cache miss; checking active session in MongoDB');
                const sessionDoc = await refreshTokenModel.findOne({ familyId: decoded.familyId, isRotated: false }).select({ _id: 0, familyId: 1 }).lean();
                isSessionActive = Boolean(sessionDoc);

                if (isSessionActive) {
                    // Self-heal Redis session cache with refresh token TTL
                    const sessionTtl = Math.floor(CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000);
                    await safeRedis.set(REDIS_KEYS.session(decoded.familyId), '1', sessionTtl);
                    logger.debug({ familyId: decoded.familyId }, 'Self-healed Redis session cache from MongoDB');
                }
            }

            if (!isSessionActive) {
                logger.warn({ familyId: decoded.familyId }, 'Revoked or expired session accessed; clearing credentials');
                clearTokenCookies(res);
                throw new ApiError(401, 'Session has been revoked. Please sign in again.');
            }
        }

        req.user = decoded._id;
        req.tokenVersion = decoded.tokenVersion;
        req.familyId = decoded.familyId;
        next();
    }

    catch (error) {
        next(error);
    }
}