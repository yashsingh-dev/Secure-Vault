import crypto from 'crypto';

export default function secureHash(input) {
    const secret_key = process.env.CRYPTO_TOKEN_KEY || 'default-key';
    try {
        return crypto
            .createHmac('sha256', secret_key)
            .update(input)
            .digest('hex');
    } catch (error) {
        throw error;
    }
}