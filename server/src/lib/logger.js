import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // Industry Standard: Redact sensitive keys so they are NEVER leaked into logs or cloud drains
  redact: {
    paths: [
      'password',
      'confirmPassword',
      'currentPassword',
      'newPassword',
      'masterKey',
      'encryptionKey',
      'token',
      'refreshToken',
      'accessToken',
      'secret',
      'creditCard',
      'cvv',
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
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