import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, generateResetToken } from '../../../src/utils/setJwtToken.utils.js';
import { safeRedis } from '../../../src/db/redis.js';
import refreshTokenModel from '../../../src/models/refreshToken.model.js';

describe('Unit: setJwtToken.utils', () => {
    const mockUserId = '64f1a2b3c4d5e6f7a8b9c0d1';
    const mockTokenVersion = 2;
    const mockFamilyId = 'fam-uuid-1234';

    beforeEach(() => {
        vi.spyOn(safeRedis, 'updateUserProfile').mockResolvedValue(true);
        vi.spyOn(safeRedis, 'set').mockResolvedValue(true);
        vi.spyOn(refreshTokenModel, 'create').mockResolvedValue({});
    });

    describe('generateAccessToken', () => {
        it('should issue a valid JWT with user ID, token version, and family ID', async () => {
            const token = await generateAccessToken(mockUserId, mockTokenVersion, mockFamilyId);

            expect(typeof token).toBe('string');
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_KEY);
            expect(decoded._id).toBe(mockUserId);
            expect(decoded.tokenVersion).toBe(mockTokenVersion);
            expect(decoded.familyId).toBe(mockFamilyId);
        });

        it('should sync tokenVersion to safeRedis.updateUserProfile', async () => {
            const spy = vi.spyOn(safeRedis, 'updateUserProfile').mockResolvedValue(true);
            await generateAccessToken(mockUserId, mockTokenVersion, mockFamilyId);

            expect(spy).toHaveBeenCalledWith(mockUserId, { tokenVersion: mockTokenVersion });
        });
    });

    describe('generateRefreshToken', () => {
        it('should generate a refresh token and store session presence in Redis and MongoDB', async () => {
            const redisSpy = vi.spyOn(safeRedis, 'set').mockResolvedValue(true);
            const mongoSpy = vi.spyOn(refreshTokenModel, 'create').mockResolvedValue({});

            const token = await generateRefreshToken(mockUserId, false, { ip: '127.0.0.1' }, mockFamilyId);

            expect(typeof token).toBe('string');
            expect(mongoSpy).toHaveBeenCalled();
            expect(redisSpy).toHaveBeenCalled();
        });
    });

    describe('generateResetToken', () => {
        it('should generate a reset token and store in Redis', async () => {
            const redisSpy = vi.spyOn(safeRedis, 'set').mockResolvedValue(true);

            const token = await generateResetToken(mockUserId);

            expect(typeof token).toBe('string');
            const decoded = jwt.verify(token, process.env.JWT_RESET_KEY);
            expect(decoded._id).toBe(mockUserId);
            expect(redisSpy).toHaveBeenCalled();
        });
    });
});
