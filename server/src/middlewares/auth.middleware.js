import jwt from 'jsonwebtoken';
import blacklistTokenModel from "../models/blacklistToken.model.js";
import refreshTokenModel from "../models/refreshToken.model.js";
import ApiError from '../utils/ApiError.js';
import secureHash from "../utils/crypto.utils.js";
import userModel from '../models/user.model.js';
import { clearTokenCookies } from '../utils/setCookies.utils.js';

export const authenticate = async (req, res, next) => {
    try {

        // Check Access Token
        const accessToken = req.cookies.accessToken;
        if (!accessToken || accessToken === 'undefined') {
            throw new ApiError(401, 'Access Token Missing');
        }

        // Check for access token hash in Blacklist
        const hashAccessToken = secureHash(accessToken);
        let isBlacklisted = await blacklistTokenModel.findOne({ token: hashAccessToken }).select({ token: 1, _id: 0 }).lean();
        if (isBlacklisted) {
            throw new ApiError(403, 'Session has been revoked. Please sign in again.');
        }

        // Verify JWT Signature and expiry
        const secret_key = process.env.JWT_ACCESS_KEY || 'default-key';
        let decoded = jwt.verify(accessToken, secret_key);

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