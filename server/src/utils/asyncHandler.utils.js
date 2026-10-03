/**
 * Higher-order function that wraps async Express route handlers.
 * It catches any errors and forwards them to Express's next() error handling middleware,
 * completely eliminating the need for repetitive try-catch blocks in controllers (DRY).
 *
 * @param {Function} fn - The asynchronous controller / middleware function
 * @returns {Function} Express route handler
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next); // is shorthand for .catch(error => next(error)).
};

export default asyncHandler;


// Explanation:-

// What happens in reality:

// Take a look at the exact code of your asyncHandler:

// javascript
// const asyncHandler = (fn) => (req, res, next) => {
//     Promise.resolve(fn(req, res, next)).catch(next);
// };

// Notice where fn(req, res, next) is!

// 1. fn(req, res, next) is called FIRST, ALWAYS (Immediately)

// You don't wait for the promise to resolve before calling fn(req, res, next).

// Instead:

// Express calls the function returned by asyncHandler.
// asyncHandler immediately calls your controller function: fn(req, res, next).
// Because your controller is an async function, calling it returns a Promise.
// 2. What happens to that Promise?

// Now that fn(req, res, next) has already started executing:

// Case A: The Happy Path (Promise Resolves / Accepted):

// Your service runs smoothly.
// The controller sends the response: return response(res, 200, ...)
// The Promise resolves successfully.
// The .catch(next) block is completely ignored. The request is finished!

// Case B: The Error Path (Promise Rejects):

// Your service throws: throw new ApiError(401, '...')
// Because the controller is await-ing the service, the controller's Promise rejects.
// That rejection triggers .catch(next).
// .catch(next) is shorthand for .catch(error => next(error)).
// It hands the error directly to Express's next(error), which jumps straight to your 4-argument errorHandler!
