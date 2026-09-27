import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
    baseURL: API_BASE_URL + '/api' + '/v1',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Generic helper function to handle API requests and standard error response
export const request = async (config) => {
    try {
        const response = await apiClient(config);
        return response.data;
    } catch (error) {
        const errorMessage = error.response?.data?.message || `HTTP error! status: ${error.response?.status}`;
        throw new Error(errorMessage);
    }
};

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });
    failedQueue = [];
};

apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (error.response) {
            const { status, data } = error.response;
            if (
                status === 401 &&
                (data.message === 'Token Expired' ||
                    data.message === 'Your session has expired. Please sign in again.' ||
                    data.message === 'Access Token Missing') &&
                !originalRequest._retry
            ) {
                // Avoid refresh loop if the refresh request itself fails
                if (
                    originalRequest.url?.includes('/auth/token-refresh') ||
                    originalRequest.url?.includes('/auth/tokenRefresh')
                ) {
                    return Promise.reject(error);
                }

                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    })
                        .then(() => {
                            return apiClient(originalRequest);
                        })
                        .catch((err) => {
                            return Promise.reject(err);
                        });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    await request({ url: '/auth/token-refresh', method: 'GET' });
                    processQueue(null);
                    return apiClient(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError);
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }
        }
        return Promise.reject(error);
    }
);
