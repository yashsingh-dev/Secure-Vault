import mongoose from 'mongoose';
import { CONSTANTS } from '../config/constants.js';

const refreshTokenModel = mongoose.Schema({
    token: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    familyId: {
        type: mongoose.Schema.Types.ObjectId,
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

refreshTokenModel.index({ token: 1, familyId: 1 });
refreshTokenModel.index({ userId: 1, familyId: 1 });
refreshTokenModel.index({ userId: 1, isRotated: 1, lastActive: -1 });
refreshTokenModel.index({ familyId: 1, isRotated: 1 });


export default mongoose.model('refreshToken', refreshTokenModel);