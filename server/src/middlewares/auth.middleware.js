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

        // Check for access token hash in Redis Blacklist
        const hashAccessToken = secureHash(accessToken);
        try {
            const isBlacklisted = await redis.exists(REDIS_KEYS.blacklist(hashAccessToken));
            if (isBlacklisted) {
                clearToken(res, CONSTANTS.NAME.ACCESS_TOKEN);
                throw new ApiError(403, 'Session has been revoked. Please sign in again.');
            }
        } catch (redisErr) {
            if (redisErr instanceof ApiError) throw redisErr;
            // High-availability strategy: Fail-open with warning so Redis outages don't block legitimate users,
            // while remaining checks (tokenVersion, session) still guard integrity.
            console.error('Redis blacklist check error:', redisErr.message);
        }

        // Check token version in user and verify that token family / session is still active in parallel
        const [user_data, isSessionActive] = await Promise.all([
            userModel.findById(decoded._id).select('tokenVersion').lean(),
            decoded.familyId ? refreshTokenModel.exists({ familyId: decoded.familyId }) : true
        ]);

        if (!user_data) {
            clearTokenCookies(res);
            throw new ApiError(409, 'User account no longer exists.');
        }

        if (user_data.tokenVersion !== decoded.tokenVersion) {
            clearTokenCookies(res);
            throw new ApiError(401, 'Session has ended. Please sign in again.');
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