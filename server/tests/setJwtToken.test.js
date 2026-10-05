import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateAccessToken } from '../src/utils/setJwtToken.utils.js';
import { safeRedis } from '../src/db/redis.js';

describe('Unit Test: generateAccessToken()', () => {
  const mockUserId = '64f1a2b3c4d5e6f7a8b9c0d1';
  const mockTokenVersion = 2;
  const mockFamilyId = 'fam-uuid-1234';

  beforeEach(() => {
    // Reset or mock Redis so the unit test doesn't depend on external network/Redis state
    vi.spyOn(safeRedis, 'updateUserProfile').mockResolvedValue(true);
  });

  describe('Happy Path', () => {
    it('should generate a valid signed JWT with correct payload values', async () => {
      // Act
      const token = await generateAccessToken(mockUserId, mockTokenVersion, mockFamilyId);

      // Assert: token is a non-empty string
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts: header.payload.signature

      // Assert: verify token payload matches the arguments we passed
      const secret = process.env.JWT_ACCESS_KEY || 'default-key';
      const decoded = jwt.verify(token, secret);

      expect(decoded._id).toBe(mockUserId);
      expect(decoded.tokenVersion).toBe(mockTokenVersion);
      expect(decoded.familyId).toBe(mockFamilyId);
      expect(decoded.exp).toBeDefined(); // expiresIn was attached
    });

    it('should call safeRedis.updateUserProfile with the userId and tokenVersion', async () => {
      const redisSpy = vi.spyOn(safeRedis, 'updateUserProfile').mockResolvedValue(true);

      await generateAccessToken(mockUserId, mockTokenVersion, mockFamilyId);

      // Assert: verifies the function called Redis with exact arguments
      expect(redisSpy).toHaveBeenCalledWith(mockUserId, { tokenVersion: mockTokenVersion });
    });
  });

  describe('Error Cases (Validation)', () => {
    it('should throw an error if userId is missing or empty', async () => {
      await expect(generateAccessToken('', mockTokenVersion, mockFamilyId))
        .rejects.toThrow('User ID is required');
    });

    it('should throw an error if familyId is missing or empty', async () => {
      await expect(generateAccessToken(mockUserId, mockTokenVersion, ''))
        .rejects.toThrow('Family ID is required');
    });

    it('should throw an error if tokenVersion is NaN', async () => {
      await expect(generateAccessToken(mockUserId, 'invalid-version', mockFamilyId))
        .rejects.toThrow('Token Version is required');
    });
  });
});
