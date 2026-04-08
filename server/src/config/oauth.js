import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(
    process.env.OAUTH_GOOGLE_CLIENT_ID,
    process.env.OAUTH_GOOGLE_SECRET,
    'postmessage'
);

export default googleClient;