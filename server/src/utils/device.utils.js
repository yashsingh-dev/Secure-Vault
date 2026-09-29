/**
 * Parses user agent and request data to extract client metadata (device, browser, OS, IP).
 */
export const parseClientMeta = (req) => {
    const userAgent = req.headers['user-agent'] || '';
    
    // Extract IP address (handles proxies, x-forwarded-for, IPv6 localhost)
    let ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'Unknown IP';
    if (typeof ip === 'string') {
        ip = ip.split(',')[0].trim();
        if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') {
            ip = '127.0.0.1 (Localhost)';
        } else if (ip.startsWith('::ffff:')) {
            ip = ip.replace('::ffff:', '');
        }
    }

    const { os, browser, device } = parseUserAgent(userAgent);

    return {
        ip,
        userAgent,
        os,
        browser,
        device
    };
};

/**
 * Pure helper to parse an arbitrary User-Agent string
 */
export const parseUserAgent = (ua = '') => {
    if (!ua) {
        return {
            os: 'Unknown OS',
            browser: 'Unknown Browser',
            device: 'Desktop'
        };
    }

    // 1. Detect OS
    let os = 'Unknown OS';
    if (/windows nt 10\.0/i.test(ua)) os = 'Windows 10/11';
    else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1';
    else if (/windows nt 6\.2/i.test(ua)) os = 'Windows 8';
    else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7';
    else if (/windows/i.test(ua)) os = 'Windows';
    else if (/iphone/i.test(ua)) os = 'iOS (iPhone)';
    else if (/ipad/i.test(ua)) os = 'iPadOS (iPad)';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/cros/i.test(ua)) os = 'Chrome OS';
    else if (/linux/i.test(ua)) os = 'Linux';

    // 2. Detect Device Type
    let device = 'Desktop';
    if (/ipad|tablet/i.test(ua)) {
        device = 'Tablet';
    } else if (/mobile|iphone|ipod|android/i.test(ua)) {
        device = 'Mobile';
    }

    // 3. Detect Browser
    let browser = 'Unknown Browser';
    let match;

    if ((match = ua.match(/edg(?:e|a|ios)?\/([0-9]+)/i))) {
        browser = `Edge ${match[1]}`;
    } else if ((match = ua.match(/opr\/([0-9]+)|opera\/([0-9]+)/i))) {
        browser = `Opera ${match[1] || match[2]}`;
    } else if ((match = ua.match(/chrome\/([0-9]+)|crios\/([0-9]+)/i))) {
        browser = `Chrome ${match[1] || match[2]}`;
    } else if ((match = ua.match(/firefox\/([0-9]+)|fxios\/([0-9]+)/i))) {
        browser = `Firefox ${match[1] || match[2]}`;
    } else if ((match = ua.match(/version\/([0-9]+).*safari/i))) {
        browser = `Safari ${match[1]}`;
    } else if (/postman/i.test(ua)) {
        browser = 'Postman';
    } else if (/curl/i.test(ua)) {
        browser = 'cURL';
    } else {
        browser = 'Browser';
    }

    return { os, device, browser };
};
