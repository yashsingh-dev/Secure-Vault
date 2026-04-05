const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const defaultHeaders = {
    'Content-Type': 'application/json',
};

// Generic helper function to handle API requests
const request = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Default to sending credentials if not specified
    if (options.credentials === undefined) {
        options.credentials = 'include';
    }

    options.headers = {
        ...defaultHeaders,
        ...options.headers,
    };

    try {
        const response = await fetch(url, options);
        
        // Parse JSON response body if present
        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        }

        if (!response.ok) {
            // Throw custom error including server message if present
            const errorMessage = data?.message || `HTTP error! status: ${response.status}`;
            throw new Error(errorMessage);
        }

        return data;
    } catch (error) {
        console.error(`API Request failed for ${endpoint}:`, error);
        throw error;
    }
};

/**
 * Auth API implementations mapping to backend auth routes
 */
export const AuthAPI = {
    /**
     * @route POST /api/auth/login
     * @param {Object} credentials - The login credentials
     * @param {string} credentials.email - User email
     * @param {string} credentials.password - User password
     */
    login: async (credentials) => {
        return request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        });
    },

    /**
     * @route POST /api/auth/register
     * @param {Object} userData - Registration information
     * @param {string} userData.name - User full name
     * @param {string} userData.email - User email
     * @param {string} userData.password - User password
     */
    register: async (userData) => {
        return request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    },

    /**
     * @route POST /api/auth/send-otp
     * @param {Object} data - Payload containing email
     * @param {string} data.email - The email address to send OTP to
     */
    sendOTP: async (data) => {
        return request('/auth/send-otp', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    /**
     * @route POST /api/auth/verify-otp
     * @param {Object} data - OTP verification payload
     * @param {string} data.email - User email
     * @param {string} data.otp - The one-time password to verify
     */
    verifyOTP: async (data) => {
        return request('/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
};
