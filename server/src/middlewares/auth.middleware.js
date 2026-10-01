import jwt from 'jsonwebtoken';
import refreshTokenModel from "../models/refreshToken.model.js";
import ApiError from '../utils/ApiError.js';
import secureHash from "../utils/crypto.utils.js";
import userModel from '../models/user.model.js';
import { clearToken, clearTokenCookies, getAccessToken } from '../utils/setCookies.utils.js';
import { safeRedis } from '../db/redis.js';
import { CONSTANTS } from '../config/constants.js';
import REDIS_KEYS from '../config/redisKeys.js';

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

        // 2. Token Version Check (Redis -> MongoDB Fallback)
        let activeTokenVersion = await safeRedis.get(REDIS_KEYS.userTokenVersion(decoded._id));
        if (activeTokenVersion !== null) {
            activeTokenVersion = parseInt(activeTokenVersion, 10);
        } else {
            // Fallback: Query MongoDB if Redis missed or failed
            const userData = await userModel.findById(decoded._id).select({ tokenVersion: 1 }).lean();
            if (!userData) {
                clearTokenCookies(res);
                throw new ApiError(409, 'User account no longer exists.');
            }
            activeTokenVersion = userData.tokenVersion;

            // Self-heal Redis cache
            safeRedis.set(REDIS_KEYS.userTokenVersion(decoded._id), activeTokenVersion);
        }

        if (activeTokenVersion !== decoded.tokenVersion) {
            clearTokenCookies(res);
            throw new ApiError(401, 'Session has ended. Please sign in again.');
        }

        // 3. Active Session Family Check (Redis -> MongoDB Fallback)
        let isSessionActive = await safeRedis.exists(REDIS_KEYS.session(decoded.familyId));
        if (!isSessionActive) {
            // Fallback: Query MongoDB if Redis reported false/offline
            const sessionDoc = await refreshTokenModel.exists({ familyId: decoded.familyId });
            isSessionActive = Boolean(sessionDoc);

            if (isSessionActive) {
                // Self-heal Redis session cache with refresh token TTL
                const sessionTtl = Math.floor(CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000);
                safeRedis.set(REDIS_KEYS.session(decoded.familyId), '1', sessionTtl);
            }
        }

        if (!isSessionActive) {
            clearTokenCookies(res);
            throw new ApiError(401, 'Session has been revoked. Please sign in again.');
        }

        req.user = decoded._id;
        req.familyId = decoded.familyId;
        next();
    }

    catch (error) {
        next(error);
    }
}