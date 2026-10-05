import dotenv from 'dotenv';
dotenv.config();

// Enforce test environment
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_KEY = process.env.JWT_ACCESS_KEY || 'test-jwt-access-key-minimum-32-chars';
process.env.JWT_REFRESH_KEY = process.env.JWT_REFRESH_KEY || 'test-jwt-refresh-key-minimum-32-chars';
process.env.JWT_RESET_KEY = process.env.JWT_RESET_KEY || 'test-jwt-reset-key-minimum-32-chars';
process.env.CSRF_SECRET = process.env.CSRF_SECRET || 'a8b3c9d7e5f142389a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f';
process.env.CRYPTO_TOKEN_KEY = process.env.CRYPTO_TOKEN_KEY || 'test-crypto-token-key-minimum-32-chars';
process.env.RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || 'test-recaptcha-secret-key';
