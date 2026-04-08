import mongoose from 'mongoose';

const BlacklistTokenModel = mongoose.Schema({
    token: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // 1 hour
    }
}, { timestamps: true });

export default mongoose.model('blacklistToken', BlacklistTokenModel);