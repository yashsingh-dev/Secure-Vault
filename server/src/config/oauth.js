import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(
    process.env.OAUTH_GOOGLE_CLIENT_ID,
    process.env.OAUTH_GOOGLE_SECRET,
    (process.env.CLIENT_URL_DEV || 'http://localhost:5173') + '/auth/callback'
);

export default googleClient;