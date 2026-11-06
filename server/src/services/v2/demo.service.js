import ApiError from '../../utils/ApiError.js';

const JSONPLACEHOLDER_BASE_URL = 'https://jsonplaceholder.typicode.com';

const getUsers = async () => {
    try {
        const response = await fetch(`${JSONPLACEHOLDER_BASE_URL}/users`, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new ApiError(response.status, `Failed to fetch users from external source (${response.statusText})`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(502, `Error fetching demo users: ${error.message}`);
    }
};

const getTodos = async () => {
    try {
        const response = await fetch(`${JSONPLACEHOLDER_BASE_URL}/todos`, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new ApiError(response.status, `Failed to fetch todos from external source (${response.statusText})`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(502, `Error fetching demo todos: ${error.message}`);
    }
};

export default {
    getUsers,
    getTodos
};
