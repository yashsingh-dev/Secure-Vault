import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
    baseURL: API_BASE_URL + '/v1',
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

apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        if (error.response) {
            const { status, data } = error.response;
            if (
                status === 401 &&
                (data.message === 'Token Expired' ||
                    data.message === 'Access Token Missing')
            ) {
                try {
                    await request({url: '/auth/token-refresh', method: 'GET'});
                    return apiClient(error.config);
                } catch (refreshError) {
                    return Promise.reject(refreshError);
                }
            }
        }
        return Promise.reject(error);
    }
)
