const commonCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/'
};

export const setAuthTokens = async function (res, cookieName, token, maxAge) {

    res.cookie(cookieName, token, {
        ...commonCookieOptions,
        maxAge: maxAge
    });
};

export const clearToken = async function (res, cookieName) {
    res.clearCookie(cookieName, commonCookieOptions);
};

export const clearTokenCookies = async function (res) {
    res.clearCookie('accessToken', commonCookieOptions);
    res.clearCookie('refreshToken', commonCookieOptions);
};