import userModel from '../../models/user.model.js';
import ApiError from '../../utils/ApiError.js';

const getProfile = async (userId) => {
    try {
        const user = await userModel.findById(userId).select('-password -resetToken -otp -otpExpiry -otpCoolDown -otpAttempts').lean();
        if (!user) {
            throw new ApiError(404, 'User account no longer exists.');
        }

        return {
            id: user._id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified,
            googleLogin: user.googleLogin,
            settings: {
                alwaysRequireOtp: user.settings?.alwaysRequireOtp || false
            },
            lastLogin: user.lastLogin,
            createdAt: user.createdAt
        };
    } catch (error) {
        throw error;
    }
};

const updateProfile = async (userId, updateData) => {
    try {
        const user = await userModel.findById(userId);
        if (!user) {
            throw new ApiError(404, 'User account no longer exists.');
        }

        // Update Allowed Fields
        if (updateData.name !== undefined) {
            user.name = updateData.name.trim();
        }

        if (updateData.alwaysRequireOtp !== undefined) {
            if (!user.settings) {
                user.settings = {};
            }
            user.settings.alwaysRequireOtp = Boolean(updateData.alwaysRequireOtp);
        }

        await user.save();

        return {
            id: user._id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified,
            googleLogin: user.googleLogin,
            settings: {
                alwaysRequireOtp: user.settings?.alwaysRequireOtp || false
            },
            lastLogin: user.lastLogin,
            createdAt: user.createdAt
        };
    } catch (error) {
        throw error;
    }
};

export default {
    getProfile,
    updateProfile
};
