import userModel from '../../models/user.model.js';
import ApiError from '../../utils/ApiError.js';

const getProfile = async (userId) => {
    const user = await userModel.findById(userId).select('name email isVerified googleLogin settings lastLogin createdAt').lean();
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
            alwaysRequireOtp: user.settings?.alwaysRequireOtp || false,
            notifyOnLogin: user.settings?.notifyOnLogin ?? true
        },
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
    };
};

const updateProfile = async (userId, updateData) => {
    const updateFields = {};

    // Explicit check: only allow updating 'name' and 'settings'
    if (updateData.name !== undefined) {
        updateFields.name = typeof updateData.name === 'string' ? updateData.name.trim() : updateData.name;
    }

    // Support settings object as well as legacy alwaysRequireOtp/notifyOnLogin parameters
    if (updateData.settings !== undefined) {
        if (updateData.settings?.alwaysRequireOtp !== undefined) {
            updateFields['settings.alwaysRequireOtp'] = Boolean(updateData.settings.alwaysRequireOtp);
        }
        if (updateData.settings?.notifyOnLogin !== undefined) {
            updateFields['settings.notifyOnLogin'] = Boolean(updateData.settings.notifyOnLogin);
        }
    }
    
    if (updateData.alwaysRequireOtp !== undefined) {
        updateFields['settings.alwaysRequireOtp'] = Boolean(updateData.alwaysRequireOtp);
    }
    if (updateData.notifyOnLogin !== undefined) {
        updateFields['settings.notifyOnLogin'] = Boolean(updateData.notifyOnLogin);
    }

    if (Object.keys(updateFields).length === 0) {
        throw new ApiError(400, 'No valid fields provided for update.');
    }

    const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        { $set: updateFields },
        { new: true, runValidators: true }
    ).select('name email isVerified googleLogin settings lastLogin createdAt').lean();

    if (!updatedUser) {
        throw new ApiError(404, 'User account no longer exists.');
    }

    return {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isVerified: updatedUser.isVerified,
        googleLogin: updatedUser.googleLogin,
        settings: {
            alwaysRequireOtp: updatedUser.settings?.alwaysRequireOtp || false,
            notifyOnLogin: updatedUser.settings?.notifyOnLogin ?? true
        },
        lastLogin: updatedUser.lastLogin,
        createdAt: updatedUser.createdAt
    };
};

export default {
    getProfile,
    updateProfile
};
