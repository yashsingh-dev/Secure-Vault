import jwt from 'jsonwebtoken';
import { CONSTANTS } from '../config/constants.js'
import refreshTokenModel from '../models/refreshToken.model.js';
import { createHash } from './bcrypt.utils.js';

export const generateAccessToken = async function (userId) {
    const secret_key = process.env.JWT_ACCESS_KEY || 'default-key';
    try {
        let access_token = jwt.sign({ _id: userId }, secret_key, {
            expiresIn: CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN
        });

        return access_token;
    } catch (error) {
        throw error;
    }
}

export const generateRefreshToken = async function (userId) {
    const secret_key = process.env.JWT_REFRESH_KEY || 'default-key';
    try {
        let refresh_token = jwt.sign({ _id: userId }, secret_key, {
            expiresIn: CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN
        });

        // Generate Hash of refresh token
        const hash_refresh_token = createHash(refresh_token);

        // Store in DB
        await refreshTokenModel.create({ token: hash_refresh_token, userId });

        return refresh_token;
    } catch (error) {
        throw error;
    }
}