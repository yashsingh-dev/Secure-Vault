import mongoose from "mongoose";
import { CONSTANTS } from "../config/constants.js";

const userModel = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        select: false,
        minLength: [CONSTANTS.PASSWORD.MIN_LENGTH, `Password must be at least ${CONSTANTS.PASSWORD.MIN_LENGTH} characters long.`]
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    blockReason: {
        type: String,
        default: ''
    },
    blockedAt: {
        type: Date,
        default: null
    },
    blockExpiresAt: {
        type: Date,
        default: null
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    tokenVersion: {
        type: Number,
        default: 0
    },
    otp: {
        type: Number,
        default: null
    },
    otpExpiry: {
        type: Date,
        default: null
    },
    otpCoolDown: {
        type: Date,
        default: null
    },
    otpAttempts: {
        type: Number,
        default: 0
    },
    googleLogin: {
        type: Boolean,
        default: false
    },
    settings: {
        alwaysRequireOtp: {
            type: Boolean,
            default: true
        },
        notifyOnLogin: {
            type: Boolean,
            default: true
        }
    },
    resetToken: {
        type: String,
        default: null
    },
    resetTokenExpiry: {
        type: Date,
        default: null
    }
}, { timestamps: true });

export default mongoose.model('user', userModel);