import { demoUsers, demoTodos } from '../../data/demoData.js';

/**
 * Utility function to pick N unique random items from an array
 * without mutating the source dataset.
 *
 * @param {Array} array - Source dataset
 * @param {number} count - Number of random items to select
 * @returns {Array} Selected random items
 */
const getRandomItems = (array, count = 7) => {
    if (!Array.isArray(array) || array.length === 0) {
        return [];
    }

    const sampleSize = Math.min(count, array.length);
    const pool = [...array];

    // Partial Fisher-Yates shuffle
    for (let i = 0; i < sampleSize; i++) {
        const randomIndex = i + Math.floor(Math.random() * (pool.length - i));
        [pool[i], pool[randomIndex]] = [pool[randomIndex], pool[i]];
    }

    return pool.slice(0, sampleSize);
};

/**
 * Returns 7 random users from the local demo dataset
 * @param {number} [count=7]
 * @returns {Promise<Array>}
 */
const getUsers = async (count = 7) => {
    return getRandomItems(demoUsers, count);
};

/**
 * Returns 7 random todos from the local demo dataset
 * @param {number} [count=7]
 * @returns {Promise<Array>}
 */
const getTodos = async (count = 7) => {
    return getRandomItems(demoTodos, count);
};

export default {
    getUsers,
    getTodos
};
