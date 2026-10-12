import * as Sentry from '@sentry/node';

// Only initialize Sentry if SENTRY_DSN is provided in environment variables
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',

    // Performance Monitoring (Traces API endpoints, database queries, Redis calls)
    // 1.0 = capture 100% of transactions during dev/testing, lower (e.g. 0.2) for high-scale production

    // tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    tracesSampleRate: 1.0,

    // Auto-instrument MongoDB, Express, HTTP, etc.
    integrations: [
      Sentry.mongooseIntegration(),
    ],

    // Ensure sensitive secrets and tokens are stripped before leaving your server
    beforeSend(event) {
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      if (event.request?.headers?.authorization) {
        event.request.headers.authorization = '[REDACTED]';
      }
      return event;
    },
  });
}

export default Sentry;
