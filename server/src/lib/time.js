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
