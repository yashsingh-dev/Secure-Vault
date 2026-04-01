import jwt from 'jsonwebtoken';
import userModel from "../models/user.model.js";
import adminModel from "../models/admin.js";
import blacklistTokenModel from '../models/blacklistToken.model.js';
import { clearTokenCookies } from '../utils/setCookies.utils.js';
import { secureHash } from '../utils/crypto.utils.js';
import ApiError from '../utils/ApiError.js';

export const authenticate = async (req, res, next) => {
    try {

        // Check Access Token
        const accessToken = req.cookies.accessToken;
        const refreshToken = req.cookies.refreshToken;
        if (!accessToken || accessToken === 'undefined') {
            throw new ApiError(401, 'Access Token Missing');
        }

        // Check for access token hash in Blacklisted DB
        const hashAccessToken = secureHash(accessToken);
        let isBlacklisted = await blacklistTokenModel.findOne({ token: hashAccessToken });
        if (isBlacklisted) {
            throw new ApiError(403, 'Token Has Been Revoked');
        }

        // Verify JWT Signature and expiry
        const secret_key = process.env.JWT_ACCESS_KEY || 'default-key';
        let decoded = jwt.verify(accessToken, secret_key);

        let user_data = await userModel.findById(decoded._id);
        if (!user_data) {
            clearTokenCookies(res);
            throw new ApiError(409, 'User Not Found');
        }

        req.user = {
            ...user_data.toObject(),
            accessToken,
            refreshToken
        };
        next();
    }
    catch (error) {
        next(error);
    }
}

export const authenticateAdmin = async (req, res, next) => {
    try {
        // Check Access Token
        const accessToken = req.cookies.accessToken;
        const refreshToken = req.cookies.refreshToken;
        if (!accessToken || accessToken === 'undefined') {
            throw new ApiError(401, 'Access Token Missing');
        }

        // Check for access token hash in Blacklisted DB
        const hashAccessToken = secureHash(accessToken);
        let isBlacklisted = await blacklistTokenModel.findOne({ token: hashAccessToken });
        if (isBlacklisted) {
            throw new ApiError(403, 'Token Has Been Revoked');
        }

        // Verify JWT Signature and expiry
        const secret_key = process.env.JWT_ACCESS_KEY || 'default-key';
        let decoded = jwt.verify(accessToken, secret_key);

        let admin_data = await adminModel.findById(decoded._id);
        if (!admin_data) {
            clearTokenCookies(res);
            throw new ApiError(409, 'Admin Not Found');
        }

        req.user = {
            ...admin_data.toObject(),
            accessToken,
            refreshToken
        };
        next();
    }
    catch (error) {
        next(error);
    }
}