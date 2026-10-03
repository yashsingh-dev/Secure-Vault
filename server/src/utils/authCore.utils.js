import userModel from '../models/user.model.js';
import ApiError from './ApiError.js';
import { safeRedis } from '../db/redis.js';
import REDIS_KEYS from '../config/redisKeys.js';
import { formatTimeRemaining } from '../lib/time.js';

/**
 * Checks if a user is currently blocked, enforces lockout errors,
 * and atomically unblocks expired blocks across MongoDB and Redis.
 *
 * @param {string|mongoose.Types.ObjectId} userId - The user's ID
 * @param {object|null} [userDoc=null] - Optional pre-fetched MongoDB user document (authoritative RAM source)
 * @returns {Promise<object>} The unblocked or verified user state
 */
export const checkUserBlock = async (userId, userDoc = null) => {
    const now = Date.now();
    const userIdStr = userId.toString().trim();

    if (!userDoc) {
        const blockReason = await safeRedis.get(REDIS_KEYS.userBlock(userIdStr));
        if (blockReason) {
            throw new ApiError(403, `Your account is temporarily locked due to: ${blockReason}.`);
        }

        // Cache Miss - Fallback to database
        userDoc = await userModel.findById(userIdStr).select({ isBlocked: 1, blockExpiresAt: 1, blockReason: 1 }).lean();
        if (!userDoc) {
            throw new ApiError(404, 'User account no longer exists.');
        }
    }

    // 2. AUTHORITATIVE PATH: Using userDoc from parameter or DB fallback
    if (userDoc.isBlocked) {
        if (userDoc.blockExpiresAt > now) {
            // Calculate remaining TTL in seconds and store ONLY the blockReason string with TTL
            const ttlSeconds = Math.max(1, Math.ceil((new Date(userDoc.blockExpiresAt).getTime() - now) / 1000));
            await safeRedis.set(REDIS_KEYS.userBlock(userIdStr), userDoc.blockReason || 'Security policy violation', ttlSeconds);

            throw new ApiError(403, `Your account is temporarily locked for ${formatTimeRemaining(userDoc.blockExpiresAt)} due to: ${userDoc.blockReason}.`);
        }

        // Lock expired: Atomically unblock in MongoDB and delete the Redis presence key
        const [unblockedUser] = await Promise.all([
            userModel.findOneAndUpdate(
                { _id: userDoc._id, isBlocked: true },
                {
                    $set: {
                        isBlocked: false,
                        blockReason: null,
                        blockedAt: null,
                        blockExpiresAt: null
                    }
                },
                { new: true }
            ),
            safeRedis.del(REDIS_KEYS.userBlock(userIdStr))
        ]);

        if (unblockedUser) {
            if (userDoc.password && !unblockedUser.password) {
                unblockedUser.password = userDoc.password;
            }
            return unblockedUser;
        }
        return userDoc;
    }

    return userDoc;
};

export default {
    checkUserBlock
};
