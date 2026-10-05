import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkUserBlock } from '../../../src/utils/authCore.utils.js';
import userModel from '../../../src/models/user.model.js';
import { safeRedis } from '../../../src/db/redis.js';

describe('Unit: authCore.utils (checkUserBlock)', () => {
    const mockUserId = '64f1a2b3c4d5e6f7a8b9c0d1';

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should throw 403 if user is blocked in Redis', async () => {
        vi.spyOn(safeRedis, 'get').mockResolvedValue('Spamming attempts');

        await expect(checkUserBlock(mockUserId))
            .rejects.toThrow('Your account is temporarily locked due to: Spamming attempts.');
    });

    it('should query MongoDB if not in Redis and pass if user is not blocked', async () => {
        vi.spyOn(safeRedis, 'get').mockResolvedValue(null);
        vi.spyOn(userModel, 'findById').mockReturnValue({
            select: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue({ _id: mockUserId, isBlocked: false })
            })
        });

        const result = await checkUserBlock(mockUserId);
        expect(result.isBlocked).toBe(false);
    });

    it('should enforce lock if MongoDB user is blocked and lock has not expired', async () => {
        const futureExpiry = Date.now() + 60000;
        vi.spyOn(safeRedis, 'get').mockResolvedValue(null);
        vi.spyOn(safeRedis, 'set').mockResolvedValue(true);
        vi.spyOn(userModel, 'findById').mockReturnValue({
            select: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue({
                    _id: mockUserId,
                    isBlocked: true,
                    blockExpiresAt: futureExpiry,
                    blockReason: 'Security lockout'
                })
            })
        });

        await expect(checkUserBlock(mockUserId))
            .rejects.toThrow('Your account is temporarily locked');
    });

    it('should automatically unblock user if block has expired', async () => {
        const pastExpiry = Date.now() - 5000;
        vi.spyOn(safeRedis, 'get').mockResolvedValue(null);
        vi.spyOn(safeRedis, 'del').mockResolvedValue(1);
        vi.spyOn(userModel, 'findById').mockReturnValue({
            select: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue({
                    _id: mockUserId,
                    isBlocked: true,
                    blockExpiresAt: pastExpiry,
                    blockReason: 'Expired lockout'
                })
            })
        });
        vi.spyOn(userModel, 'findOneAndUpdate').mockResolvedValue({
            _id: mockUserId,
            isBlocked: false
        });

        const unblocked = await checkUserBlock(mockUserId);
        expect(unblocked.isBlocked).toBe(false);
    });
});
