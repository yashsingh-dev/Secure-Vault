import { z } from 'zod';
import { CONSTANTS } from '../config/constants.js';

export const emailSchema = z.email('Please enter a valid email address.');
export const passwordSchema = z.string().min(CONSTANTS.PASSWORD.MIN_LENGTH, `Password must be at least ${CONSTANTS.PASSWORD.MIN_LENGTH} characters long.`);
export const rememberMeSchema = z.boolean().optional().default(false);
export const otpCodeSchema = z.string().length(CONSTANTS.OTP.LENGTH, `Verification code must be ${CONSTANTS.OTP.LENGTH} digits.`);

export const loginSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    rememberMe: rememberMeSchema,
    recaptchaToken: z.string().optional()
});

export const resetPasswordSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    token: z.string()
});

export const registerSchema = z.object({
    name: z.string(),
    email: emailSchema,
    password: passwordSchema,
    recaptchaToken: z.string().optional()
});

export const otpSchema = z.object({
    email: emailSchema,
    otp: otpCodeSchema,
    rememberMe: rememberMeSchema
});

export const otpForResetSchema = z.object({
    email: emailSchema,
    otp: otpCodeSchema
});

export const sendOtpSchema = z.object({
    email: emailSchema
});

export const updateProfileSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters long.').max(50, 'Name cannot exceed 50 characters.').optional(),
    alwaysRequireOtp: z.boolean().optional()
});

export const googleAuthSchema = z.object({
    code: z.string({ required_error: 'Google authorization code is required.' }).min(1, 'Google authorization code cannot be empty.')
});

export const schemas = {
    emailSchema,
    passwordSchema,
    rememberMeSchema,
    otpCodeSchema,
    loginSchema,
    resetPasswordSchema,
    registerSchema,
    otpSchema,
    otpForResetSchema,
    sendOtpSchema,
    updateProfileSchema,
    googleAuthSchema
};

export default schemas;
