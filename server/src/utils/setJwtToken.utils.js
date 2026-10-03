import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { CONSTANTS } from '../config/constants.js';
import refreshTokenModel from '../models/refreshToken.model.js';
import secureHash from './crypto.utils.js';
import { safeRedis } from '../db/redis.js';
import REDIS_KEYS from '../config/redisKeys.js';

export const generateAccessToken = async function (userId, tokenVersion, familyId) {
    userId = userId.toString().trim();
    familyId = familyId.toString().trim();
    tokenVersion = Number(tokenVersion);

    if (!userId) throw new Error('User ID is required');
    if (!familyId) throw new Error('Family ID is required');
    if (isNaN(tokenVersion)) throw new Error('Token Version is required');

    const secret_key = process.env.JWT_ACCESS_KEY || 'default-key';
    try {
        const payload = {
            _id: userId,
            tokenVersion: tokenVersion,
            familyId: familyId
        };

        let access_token = jwt.sign(payload, secret_key, {
            expiresIn: CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN
        });

        console.log(`Access Token generated for ${CONSTANTS.AUTH_TOKEN.ACCESS_TOKEN}`);

        // Update tokenVersion in userProfile bucket
        await safeRedis.updateUserProfile(userId, { tokenVersion });

        return access_token;
    } catch (error) {
        throw error;
    }
}

export const generateRefreshToken = async function (userId, rememberMe = false, meta = {}, familyId) {
    userId = userId.toString().trim();
    familyId = familyId.toString().trim();
    rememberMe = Boolean(rememberMe);

    if (!userId) throw new Error('User ID is required');
    if (!familyId) throw new Error('Family ID is required');

    const secret_key = process.env.JWT_REFRESH_KEY || 'default-key';
    try {
        let refresh_token = jwt.sign({ _id: userId }, secret_key, {
            expiresIn: rememberMe ? CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN : CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN
        });

        console.log(`Refresh Token generated for ${rememberMe ? CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN : CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN}`);

        // Generate hash of refresh token
        const hash_refresh_token = secureHash(refresh_token);

        // Store in DB
        await refreshTokenModel.create({
            token: hash_refresh_token,
            userId,
            familyId,
            ip: meta.ip || 'Unknown IP',
            userAgent: meta.userAgent || '',
            device: meta.device || 'Desktop',
            browser: meta.browser || 'Unknown Browser',
            os: meta.os || 'Unknown OS',
            lastActive: new Date()
        });

        // Cache active session in Redis with TTL matching refresh token lifespan
        const ttlSeconds = Math.floor(
            (rememberMe ? CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS : CONSTANTS.AUTH_TOKEN.REFRESH_TOKEN_MS) / 1000
        );
        safeRedis.set(REDIS_KEYS.session(familyId), '1', ttlSeconds);

        return refresh_token;
    } catch (error) {
        throw error;
    }
}

export const generateResetToken = async function (userId) {
    userId = userId.toString().trim();

    if (!userId) throw new Error('User ID is required');

    const secret_key = process.env.JWT_RESET_KEY || 'default-key';
    try {
        let reset_token = jwt.sign({ _id: userId }, secret_key, {
            expiresIn: CONSTANTS.RESET_TOKEN.EXPIRY
        });

        console.log(`Reset Token generated for ${CONSTANTS.RESET_TOKEN.EXPIRY}`);

        // Cache token in Redis with TTL matching token expiration
        const ttlSeconds = Math.floor(CONSTANTS.RESET_TOKEN.EXPIRY_MS / 1000);
        await safeRedis.set(REDIS_KEYS.userResetToken(userId), reset_token, ttlSeconds);

        return reset_token;
    } catch (error) {
        throw error;
    }
}