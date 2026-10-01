import { CONSTANTS } from "../config/constants.js";

const commonCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/'
};

export const setAuthTokens = function (res, cookieName, token, maxAge) {

    res.cookie(cookieName, token, {
        ...commonCookieOptions,
        maxAge: maxAge
    });
};

export const clearToken = function (res, cookieName) {
    res.clearCookie(cookieName, commonCookieOptions);
};

export const clearTokenCookies = function (res) {
    res.clearCookie(CONSTANTS.NAME.ACCESS_TOKEN, commonCookieOptions);
    res.clearCookie(CONSTANTS.NAME.REFRESH_TOKEN, commonCookieOptions);
};

export const getAccessToken = function (req) {
    return req?.cookies?.[CONSTANTS.NAME.ACCESS_TOKEN];
};

export const getRefreshToken = function (req) {
    return req?.cookies?.[CONSTANTS.NAME.REFRESH_TOKEN];
};