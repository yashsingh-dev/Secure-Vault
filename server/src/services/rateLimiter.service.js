import redis from '../db/redis.js';
import { logger } from '../lib/logger.js';

/**
 * High-performance, atomic Redis Lua script implementing the Sliding Window Counter algorithm.
 * 
 * Mathematical Model:
 *  weightedRequests = floor(prevWindowHits * (1 - currentWindowElapsed%)) + currentWindowHits
 *  if weightedRequests + incrementBy > limit -> Block (429)
 *  else -> INCRBY currentWindow, set 2*window TTL, Allow (next())
 */
const SLIDING_WINDOW_LUA = `
  local currentKey  = KEYS[1]
  local previousKey = KEYS[2]
  local limit       = tonumber(ARGV[1])
  local now         = tonumber(ARGV[2])
  local windowMs    = tonumber(ARGV[3])
  local incrementBy = tonumber(ARGV[4]) or 1

  local currentHits = tonumber(redis.call('GET', currentKey) or 0)
  local prevHits    = tonumber(redis.call('GET', previousKey) or 0)

  local timeIntoCurrent = now % windowMs
  local percentage = timeIntoCurrent / windowMs
  local weightedPrev = math.floor((1 - percentage) * prevHits)

  local totalEstimated = weightedPrev + currentHits

  if (totalEstimated + incrementBy) > limit then
    local remaining = math.max(0, limit - totalEstimated)
    local resetMs = windowMs - timeIntoCurrent
    return { 0, remaining, resetMs } -- 0 = rejected (rate limited)
  end

  local newCurrent = redis.call('INCRBY', currentKey, incrementBy)
  if newCurrent == incrementBy then
    -- Set TTL to 2 * windowMs so it cleanly overlaps into the next interval
    redis.call('PEXPIRE', currentKey, windowMs * 2)
  end

  local remaining = math.max(0, limit - (weightedPrev + newCurrent))
  local resetMs = windowMs - timeIntoCurrent
  return { 1, remaining, resetMs } -- 1 = allowed
`;

/**
 * Core engine to execute a sliding window counter check against Redis.
 *
 * @param {object} options
 * @param {string} options.key - Unique rate limit identifier (e.g., 'rl:login:127.0.0.1')
 * @param {number} options.limit - Maximum allowed requests in the window
 * @param {number} options.windowMs - Sliding window duration in milliseconds
 * @returns {Promise<{ success: boolean, remaining: number, resetMs: number }>}
 */
export const checkSlidingWindowRateLimit = async ({ key, limit, windowMs }) => {
    const now = Date.now();
    const currentBucket = Math.floor(now / windowMs);
    const prevBucket = currentBucket - 1;

    const currentKey = `${key}:${currentBucket}`;
    const prevKey = `${key}:${prevBucket}`;

    try {
        const [allowed, remaining, resetMs] = await redis.eval(
            SLIDING_WINDOW_LUA,
            2,
            currentKey,
            prevKey,
            limit,
            now,
            windowMs,
            1
        );

        return {
            success: allowed === 1,
            remaining,
            resetMs
        };
    } catch (err) {
        // High-availability fail-open policy: If Redis experiences an error,
        // log a warning but DO NOT crash legitimate users' requests.
        logger.error({ key, err: err.message }, 'Rate limiter Redis execution failed; failing open');
        return {
            success: true,
            remaining: 1,
            resetMs: windowMs
        };
    }
};

export default checkSlidingWindowRateLimit;
