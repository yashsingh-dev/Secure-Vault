import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
    baseURL: API_BASE_URL + '/api' + '/v1',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// In-memory CSRF Token Storage
let csrfToken = null;

export const setCsrfToken = (token) => {
    csrfToken = token;
};

export const getCsrfToken = () => csrfToken;

export const fetchCsrfToken = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/csrf-token`, {
            withCredentials: true,
        });
        if (response.data?.csrfToken) {
            csrfToken = response.data.csrfToken;
            return csrfToken;
        }
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
    }
    return null;
};

// Generic helper function to handle API requests and standard error response
export const request = async (config) => {
    try {
        const response = await apiClient(config);
        return response.data;
    } catch (error) {
        const errorMessage = error.response?.data?.message || error || `HTTP error! status: ${error.response?.status}`;
        console.log("Error Message: ", error, " URL: ", config.url, " Method: ", config.method);
        console.log("Error Response: ", error.response);
        throw new Error(errorMessage);
    }
};

// Request Interceptor: Attach CSRF token to all state-changing requests
apiClient.interceptors.request.use(
    async (config) => {
        const method = config.method?.toUpperCase();
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            // Lazy load token if not yet fetched
            if (!csrfToken) {
                await fetchCsrfToken();
            }
            if (csrfToken) {
                config.headers['x-csrf-token'] = csrfToken;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

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

            // Handle CSRF Token Expiration / Invalid Token (403)
            if (
                status === 403 &&
                (data.code === 'EBADCSRFTOKEN' || data.message?.toLowerCase().includes('csrf')) &&
                !originalRequest._retryCsrf
            ) {
                originalRequest._retryCsrf = true;
                const newToken = await fetchCsrfToken();
                if (newToken) {
                    originalRequest.headers['x-csrf-token'] = newToken;
                    return apiClient(originalRequest);
                }
            }

            // Handle Access Token Expiration (401)
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
