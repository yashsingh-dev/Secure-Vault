import bcrypt from 'bcryptjs';

export const createHash = async (input) => {
    try {
        const salt = bcrypt.genSaltSync(12);
        const hash = bcrypt.hashSync(input, salt);
        return hash;
    } catch (error) {
        throw error;
    }
}

export const verifyHash = async (input, hash) => {
    try {
        return bcrypt.compareSync(input, hash);
    } catch (error) {
        throw error;
    }
}