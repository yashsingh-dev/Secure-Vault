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
    isRotated: {
        type: Boolean,
        default: false
    },
    rotatedAt: {
        type: Date,
        default: null
    },
    ip: {
        type: String,
        default: 'Unknown IP'
    },
    userAgent: {
        type: String,
        default: ''
    },
    device: {
        type: String,
        default: 'Desktop'
    },
    browser: {
        type: String,
        default: 'Unknown Browser'
    },
    os: {
        type: String,
        default: 'Unknown OS'
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: CONSTANTS.AUTH_TOKEN.LONG_REFRESH_TOKEN_MS / 1000
    }
}, { timestamps: true });

export default mongoose.model('refreshToken', RefreshTokenModel);