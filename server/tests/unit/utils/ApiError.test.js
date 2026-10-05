import { describe, it, expect } from 'vitest';
import ApiError from '../../../src/utils/ApiError.js';

describe('Unit: ApiError Utility', () => {
    it('should create an Error with statusCode and custom message', () => {
        const error = new ApiError(404, 'Resource not found');

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ApiError);
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Resource not found');
        expect(error.stack).toBeDefined();
    });
});
