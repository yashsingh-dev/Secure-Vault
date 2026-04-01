import jwt from 'jsonwebtoken';
import userModel from "../models/user.model.js";
import ApiError from '../utils/ApiError.js';

export const authenticate = async (req, res, next) => {
    try {

        // Check Access Token
        const accessToken = req.cookies.accessToken;
        if (!accessToken || accessToken === 'undefined') {
            throw new ApiError(401, 'Access Token Missing');
        }

        // Check for access token hash in Redis Blacklist table
        // const hashAccessToken = secureHash(accessToken);
        // let isBlacklisted = await blacklistTokenModel.findOne({ token: hashAccessToken });
        // if (isBlacklisted) {
        //     throw new ApiError(403, 'Token Has Been Revoked');
        // }

        // Verify JWT Signature and expiry
        const secret_key = process.env.JWT_ACCESS_KEY || 'default-key';
        let decoded = jwt.verify(accessToken, secret_key);

        // Check token version in redis user table 
        // let user_data = await userModel.findById(decoded._id);
        // if (!user_data) {
        //     clearTokenCookies(res);
        //     throw new ApiError(409, 'User Not Found');
        // }

        // req.user = user_data;
        next();
    }
    catch (error) {
        next(error);
    }
}