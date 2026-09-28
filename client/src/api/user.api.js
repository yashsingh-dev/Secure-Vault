import { request } from '../lib/axios';

export const UserAPI = {
    getProfile: async () => {
        return request({
            url: '/user/profile',
            method: 'GET',
        });
    },

    updateProfile: async (data) => {
        return request({
            url: '/user/profile',
            method: 'PUT',
            data,
        });
    },
};
