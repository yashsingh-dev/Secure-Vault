import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { CONSTANTS } from '../config/constants.js'
import refreshTokenModel from '../models/refreshToken.model.js';
import secureHash from './crypto.utils.js';

export const generateAccessToken = async function (userId, tokenVersion) {
    const secret_key = process.env.JWT_ACCESS_KEY || 'default-key';
    try {
        let access_token = jwt.sign({ _id: userId, tokenVersion }, secret_key, {
            expiresIn: CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN
        });

        console.log(`Access Token generated for ${CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN}`);

        return access_token;
    } catch (error) {
        throw error;
    }
}

export const generateRefreshToken = async function (userId, rememberMe = false, meta = {}, familyId = null) {
    const secret_key = process.env.JWT_REFRESH_KEY || 'default-key';
    try {
        let refresh_token = jwt.sign({ _id: userId }, secret_key, {
            expiresIn: rememberMe ? CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN : CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN
        });

        console.log(`Refresh Token generated for ${rememberMe ? CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN : CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN}`);

        // Generate hash of refresh token
        const hash_refresh_token = secureHash(refresh_token);

        // Assign to existing family or start a new token family
        const tokenFamilyId = familyId || new mongoose.Types.ObjectId();

        // Store in DB
        await refreshTokenModel.create({
            token: hash_refresh_token,
            userId,
            familyId: tokenFamilyId,
            ip: meta.ip || 'Unknown IP',
            userAgent: meta.userAgent || '',
            device: meta.device || 'Desktop',
            browser: meta.browser || 'Unknown Browser',
            os: meta.os || 'Unknown OS',
            lastActive: new Date()
        });

        return refresh_token;
    } catch (error) {
        throw error;
    }
}

export const generateResetToken = async function (userId) {
    const secret_key = process.env.JWT_RESET_KEY || 'default-key';
    try {
        let reset_token = jwt.sign({ _id: userId }, secret_key, {
            expiresIn: CONSTANTS.OTP.RESET_TOKEN
        });

        console.log(`Reset Token generated for ${CONSTANTS.OTP.RESET_TOKEN}`);

        return reset_token;
    } catch (error) {
        throw error;
    }
}