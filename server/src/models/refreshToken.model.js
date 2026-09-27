import mongoose from 'mongoose';
import { CONSTANTS } from '../config/constants.js';

const RefreshTokenModel = mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000
    }
}, { timestamps: true });

export default mongoose.model('refreshToken', RefreshTokenModel);