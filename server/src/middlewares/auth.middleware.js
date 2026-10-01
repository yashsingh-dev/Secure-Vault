import jwt from 'jsonwebtoken';
import refreshTokenModel from "../models/refreshToken.model.js";
import ApiError from '../utils/ApiError.js';
import secureHash from "../utils/crypto.utils.js";
import userModel from '../models/user.model.js';
import { clearToken, clearTokenCookies, getAccessToken } from '../utils/setCookies.utils.js';
import redis from '../db/redis.js';
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

        // 1. Check for blacklist accessToken
        const hashAccessToken = secureHash(accessToken);
        try {
            const isBlacklisted = await redis.exists(REDIS_KEYS.blacklist(hashAccessToken));
            if (isBlacklisted) {
                clearToken(res, CONSTANTS.NAME.ACCESS_TOKEN);
                throw new ApiError(403, 'Session has been revoked. Please sign in again.');
            }
        } catch (error) {
            if (error instanceof ApiError) throw error;
            console.error('[Redis Blacklist Fallback]: Redis unavailable, proceeding to remaining auth checks:', error.message);
        }

        // 2. Check for user tokenVersion
        let activeTokenVersion = null;
        try {
            const cachedVersion = await redis.get(REDIS_KEYS.userTokenVersion(decoded._id));
            if (cachedVersion !== null) {
                activeTokenVersion = parseInt(cachedVersion, 10);
            }
        } catch (error) {
            console.error('[Redis TokenVersion Fallback]: Cache read failed, falling back to MongoDB:', error.message);
        }

        // Fallback: Query MongoDB if Redis missed or failed
        if (activeTokenVersion === null) {
            const userData = await userModel.findById(decoded._id).select({ tokenVersion: 1 }).lean();
            if (!userData) {
                clearTokenCookies(res);
                throw new ApiError(409, 'User account no longer exists.');
            }
            activeTokenVersion = userData.tokenVersion;

            // Self-heal Redis cache
            try {
                await redis.set(REDIS_KEYS.userTokenVersion(decoded._id), activeTokenVersion.toString());
            } catch (cacheWriteErr) {
                console.error('[Redis TokenVersion Write Warning]: Failed to populate cache:', cacheWriteErr.message);
            }
        }

        if (activeTokenVersion !== decoded.tokenVersion) {
            clearTokenCookies(res);
            throw new ApiError(401, 'Session has ended. Please sign in again.');
        }

        // 3. Check for active session family
        let isSessionActive = null;

        try {
            const sessionExists = await redis.exists(REDIS_KEYS.session(decoded.familyId));
            if (sessionExists === 1) {
                isSessionActive = true;
            }
        } catch (error) {
            console.error('[Redis Session Fallback]: Cache read failed, falling back to MongoDB:', error.message);
        }

        // Fallback: Query MongoDB if Redis missed or failed
        if (isSessionActive === null) {
            const sessionDoc = await refreshTokenModel.exists({ familyId: decoded.familyId });
            isSessionActive = Boolean(sessionDoc);

            if (isSessionActive) {
                // Self-heal Redis cache with refresh token TTL
                try {
                    const sessionTtl = Math.floor(CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000);
                    await redis.set(REDIS_KEYS.session(decoded.familyId), '1', 'EX', sessionTtl); 
                } catch (cacheWriteErr) {
                    console.error('[Redis Session Write Warning]: Failed to populate cache:', cacheWriteErr.message);
                }
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