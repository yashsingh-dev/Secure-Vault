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
        minLength: [6, "Password must be atleast 6 character long"],
        required: true
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
        select: false
    },
    otpExpiry: {
        type: Date,
        select: false
    }
}, { timestamps: true });

export default mongoose.model('user', userModel);