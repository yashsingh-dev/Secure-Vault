import pino from 'pino';
import * as Sentry from '@sentry/node';

const isProduction = process.env.NODE_ENV === 'production';

// Map Pino numeric log levels to Sentry severity levels
const SENTRY_LEVEL_MAP = {
  10: 'debug',
  20: 'debug',
  30: 'info',
  40: 'warning',
  50: 'error',
  60: 'fatal',
};

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // Stream logs to Sentry as Breadcrumbs and Error Events
  hooks: {
    logMethod(inputArgs, method, level) {
      if (process.env.SENTRY_DSN) {
        try {
          let msg = '';
          let data = {};

          if (typeof inputArgs[0] === 'string') {
            msg = inputArgs[0];
          } else if (typeof inputArgs[0] === 'object' && inputArgs[0] !== null) {
            data = inputArgs[0];
            msg = typeof inputArgs[1] === 'string' ? inputArgs[1] : '';
          }

          const sentryLevel = SENTRY_LEVEL_MAP[level] || 'info';

          // 1. Record as a breadcrumb so all requests/traces have a complete audit trail
          Sentry.addBreadcrumb({
            category: 'logger',
            message: msg || undefined,
            level: sentryLevel,
            data: Object.keys(data).length > 0 ? data : undefined,
            timestamp: Date.now() / 1000,
          });

          // 2. Stream into Sentry's dedicated Logs explorer tab
          if (Sentry.logger && typeof Sentry.logger[sentryLevel] === 'function' && msg) {
            Sentry.logger[sentryLevel](msg, Object.keys(data).length > 0 ? data : undefined);
          }

          // 3. If it's an error or fatal log, capture it directly as a Sentry Issue
          if (level >= 50) {
            const errObj = data.err || data.error;
            if (errObj instanceof Error) {
              Sentry.captureException(errObj, { extra: data });
            } else if (msg) {
              Sentry.captureMessage(msg, { level: sentryLevel, extra: data });
            }
          }
        } catch {
          // Safeguard: logging must never throw or disrupt application flow
        }
      }

      return method.apply(this, inputArgs);
    },
  },

  // Industry Standard: Redact sensitive keys so they are NEVER leaked into logs or cloud drains
  redact: {
    paths: [
      'password',
      'confirmPassword',
      'currentPassword',
      'newPassword',
      'masterKey',
      'recaptchaToken',
      'encryptionKey',
      'token',
      'refreshToken',
      'accessToken',
      'secret',
      'creditCard',
      'cvv',
      'body.password',
      'body.confirmPassword',
      'body.currentPassword',
      'body.newPassword',
      'body.masterKey',
      'body.encryptionKey',
      'body.recaptchaToken',
      'body.token',
      'body.secret',
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      // '*.recaptchaToken',
      '*.token',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },

  // In local dev, use pino-pretty for clean human-readable output.
  // In production, emit raw fast JSON.
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
});