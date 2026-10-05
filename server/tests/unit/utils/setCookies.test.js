import { describe, it, expect, vi } from 'vitest';
import {
    setAuthTokens,
    clearToken,
    clearTokenCookies,
    getAccessToken,
    getRefreshToken
} from '../../../src/utils/setCookies.utils.js';
import { CONSTANTS } from '../../../src/config/constants.js';

describe('Unit: setCookies.utils', () => {
    it('should set cookie with HttpOnly, Secure, and sameSite options', () => {
        const mockRes = {
            cookie: vi.fn()
        };

        setAuthTokens(mockRes, 'test_cookie', 'sample_token_value', 60000);

        expect(mockRes.cookie).toHaveBeenCalledWith('test_cookie', 'sample_token_value', {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            path: '/',
            maxAge: 60000
        });
    });

    it('should clear specific cookie with same options', () => {
        const mockRes = {
            clearCookie: vi.fn()
        };

        clearToken(mockRes, 'test_cookie');

        expect(mockRes.clearCookie).toHaveBeenCalledWith('test_cookie', {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            path: '/'
        });
    });

    it('should clear both access and refresh token cookies in clearTokenCookies', () => {
        const mockRes = {
            clearCookie: vi.fn()
        };

        clearTokenCookies(mockRes);

        expect(mockRes.clearCookie).toHaveBeenCalledWith(CONSTANTS.NAME.ACCESS_TOKEN, expect.any(Object));
        expect(mockRes.clearCookie).toHaveBeenCalledWith(CONSTANTS.NAME.REFRESH_TOKEN, expect.any(Object));
    });

    it('should retrieve access and refresh tokens from req.cookies', () => {
        const mockReq = {
            cookies: {
                [CONSTANTS.NAME.ACCESS_TOKEN]: 'access-123',
                [CONSTANTS.NAME.REFRESH_TOKEN]: 'refresh-456'
            }
        };

        expect(getAccessToken(mockReq)).toBe('access-123');
        expect(getRefreshToken(mockReq)).toBe('refresh-456');
    });
});
