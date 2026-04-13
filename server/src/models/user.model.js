import mongoose from "mongoose";

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
        minLength: [6, "Password must be atleast 6 character long"]
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
        type: Date
    },
    tokenVersion: {
        type: Number,
        default: 0
    },
    otp: {
        type: Number
    },
    otpExpiry: {
        type: Date
    },
    otpCoolDown: {
        type: Date
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
            default: false
        }
    },
    resetToken: {
        type: String
    }
}, { timestamps: true });

export default mongoose.model('user', userModel);