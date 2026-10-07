/**
 * Converts milliseconds to a clean short suffix for Redis prefixes (e.g., 60000 -> "1m", 3600000 -> "1h").
 * @param {number} ms - Milliseconds
 * @returns {string} - Short suffix like '1m', '5m', '1h', '30s'
 */
export const msToSuffix = (ms) => {
    if (!ms || ms <= 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    if (seconds >= 86400 && seconds % 86400 === 0) return `${seconds / 86400}d`;
    if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600}h`;
    if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60}m`;
    return `${seconds}s`;
};

/**
 * Converts milliseconds to natural language phrase (e.g., 60000 -> "1 minute", 300000 -> "5 minutes").
 * @param {number} ms - Milliseconds
 * @returns {string} - "1 minute", "5 minutes", "1 hour", etc.
 */
export const msToHumanDuration = (ms) => {
    if (!ms || ms <= 0) return 'a moment';
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    if (seconds > 0 && hours === 0) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);

    return parts.join(' and ') || 'a moment';
};

/**
 * Formats milliseconds into a human-readable string (e.g., "10 minutes")
 * @param {number} expiryTime - The timestamp when the block expires
 * @returns {string} - Human readable time remaining
 */
export const formatTimeRemaining = (expiryTime) => {
    const totalMs = expiryTime - Date.now();
    
    if (totalMs <= 0) return "a moment";

    const totalSeconds = Math.ceil(totalMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''}${seconds > 0 ? ` and ${seconds} second${seconds > 1 ? 's' : ''}` : ''}`;
    }

    return `${seconds} second${seconds > 1 ? 's' : ''}`;
};

