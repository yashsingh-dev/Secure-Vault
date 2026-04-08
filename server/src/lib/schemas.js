import { z } from 'zod';

export const emailSchema = z.email('Invalid email address');
export const passwordSchema = z.string().min(6, 'Password must be at least 6 characters long');
export const rememberMeSchema = z.boolean().optional().default(false);
export const otpCodeSchema = z.string().length(6, 'Invalid OTP');

export const loginSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    rememberMe: rememberMeSchema
});

export const registerSchema = z.object({
    name: z.string(),
    email: emailSchema,
    password: passwordSchema,
});

export const otpSchema = z.object({
    email: emailSchema,
    otp: otpCodeSchema,
    rememberMe: rememberMeSchema
});
