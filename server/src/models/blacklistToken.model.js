import mongoose from 'mongoose';
import { CONSTANTS } from '../config/constants';

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
        expires: CONSTANTS.AUTH_TOKEN.BLACKLIST_TOKEN
    }
}, { timestamps: true });

export default mongoose.model('blacklistToken', BlacklistTokenModel);