import jwt from 'jsonwebtoken';
import blacklistTokenModel from "../models/blacklistToken.model.js";
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
        let isBlacklisted = await blacklistTokenModel.findOne({ token: hashAccessToken }).select('token -_id').lean();
        if (isBlacklisted) {
            throw new ApiError(403, 'Session has been revoked. Please sign in again.');
        }

        // Verify JWT Signature and expiry
        const secret_key = process.env.JWT_ACCESS_KEY || 'default-key';
        let decoded = jwt.verify(accessToken, secret_key);

        // Check token version in user 
        let user_data = await userModel.findById(decoded._id).select('tokenVersion').lean();
        if (!user_data) {
            clearTokenCookies(res);
            throw new ApiError(409, 'User account no longer exists.');
        }

        if (user_data.tokenVersion !== decoded.tokenVersion) {
            clearTokenCookies(res);
            throw new ApiError(401, 'Session has ended. Please sign in again.');
        }

        req.user = decoded._id;
        next();
    }
    catch (error) {
        next(error);
    }
}