import { request } from '../lib/axios';

export const AuthAPI = {
    login: async (credentials) => {
        return request({
            url: '/auth/login',
            method: 'POST',
            data: credentials,
        });
    },

    googleLogin: async (code) => {
        return request({
            url: '/auth/google',
            method: 'POST',
            data: { code },
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
            url: '/auth/sendOtp',
            method: 'POST',
            data: data,
        });
    },
    verifyOtpForReset: async (data) => {
        return request({
            url: '/auth/verifyOtpForReset',
            method: 'POST',
            data: data,
        });
    },

    verifyOTP: async (data) => {
        return request({
            url: '/auth/verifyOtp',
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
    },

    resetPassword: async (data) => {
        return request({
            url: '/auth/resetPassword',
            method: 'POST',
            data: data,
        });
    }
};
