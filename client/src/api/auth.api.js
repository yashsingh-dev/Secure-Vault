import { request } from '../lib/axios';

export const AuthAPI = {
    login: async (credentials) => {
        return request({
            url: '/auth/login',
            method: 'POST',
            data: credentials,
        });
    },

    register: async (userData) => {
        return request({
            url: '/auth/register',
            method: 'POST',
            data: userData,
        });
    },
    sendOTP: async (data) => {
        return request({
            url: '/auth/send-otp',
            method: 'POST',
            data: data,
        });
    },

    verifyOTP: async (data) => {
        return request({
            url: '/auth/verify-otp',
            method: 'POST',
            data: data,
        });
    },

    status: async () => {
        return request({
            url: '/auth/status',
            method: 'GET',
        });
    },

    logout: async () => {
        return request({
            url: '/auth/logout',
            method: 'GET',
        });
    },

    logoutAll: async () => {
        return request({
            url: '/auth/logoutAll',
            method: 'GET',
        });
    }
};
