import demoService from '../../services/v2/demo.service.js';
import response from '../../utils/response.utils.js';
import asyncHandler from '../../utils/asyncHandler.utils.js';

/**
 * Public unauthenticated route: Fetch demo users (ideal for testing CDN caching)
 * CDN Cache-Control: Cached at CDN edge (CloudFront) for 300s (s-maxage) and browser for 60s (max-age).
 */
const getUsers = asyncHandler(async (req, res) => {
    const users = await demoService.getUsers();

    // CDN Caching header
    res.set('Cache-Control', 'public, max-age=60, s-maxage=300');

    return response(res, 200, 'Users fetched successfully', users);
});

/**
 * Public unauthenticated route: Fetch demo todos (ideal for testing CDN caching)
 * CDN Cache-Control: Cached at CDN edge (CloudFront) for 300s (s-maxage) and browser for 60s (max-age).
 */
const getTodos = asyncHandler(async (req, res) => {
    const todos = await demoService.getTodos();

    // CDN Caching header
    res.set('Cache-Control', 'public, max-age=60, s-maxage=300');

    return response(res, 200, 'Todos fetched successfully', todos);
});

export default {
    getUsers,
    getTodos
};
