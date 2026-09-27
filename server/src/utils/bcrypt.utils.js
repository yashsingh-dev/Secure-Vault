import bcrypt from 'bcryptjs';

export const createHash = async (input) => {
    try {
        const salt = await bcrypt.genSalt(12);
        const hash = await bcrypt.hash(input, salt);
        return hash;
    } catch (error) {
        throw error;
    }
}

export const verifyHash = async (input, hash) => {
    try {
        return await bcrypt.compare(input, hash);
    } catch (error) {
        throw error;
    }
}