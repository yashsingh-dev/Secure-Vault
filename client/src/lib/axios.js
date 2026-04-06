import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
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
        console.error(`API Request failed for ${config.url}:`, error);
        // Throw custom error including server message if present
        const errorMessage = error.response?.data?.message || `HTTP error! status: ${error.response?.status}`;
        throw new Error(errorMessage);
    }
};
