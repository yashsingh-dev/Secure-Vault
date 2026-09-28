import userService from '../../services/v1/user.service.js';
import zod from '../../lib/schemas.js';
import ApiError from '../../utils/ApiError.js';
import response from '../../utils/response.utils.js';

const getProfile = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized access. Please sign in to continue.');
        }

        const profile = await userService.getProfile(req.user);
        return response(res, 200, 'Profile retrieved successfully.', profile);
    } catch (error) {
        next(error);
    }
};

const updateProfile = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized access. Please sign in to continue.');
        }

        // Validate Input
        const { success, error } = zod.updateProfileSchema.safeParse(req.body);
        if (!success) {
            throw new ApiError(400, error.issues?.[0]?.message || error.message);
        }

        const updatedProfile = await userService.updateProfile(req.user, req.body);
        return response(res, 200, 'Profile updated successfully.', updatedProfile);
    } catch (error) {
        next(error);
    }
};

export default {
    getProfile,
    updateProfile
};
