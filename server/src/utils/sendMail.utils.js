import emailClient from '../lib/emailClient.js';
import { CONSTANTS } from '../config/constants.js';
import { logger } from '../lib/logger.js';

/**
 * Common shared wrapper for beautiful modern dark-mode emails.
 * High contrast, clean typography, responsive layout, and polished accents.
 */
const renderEmailLayout = ({ title, preheader, contentHtml }) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; mso-hide: all;">
            ${preheader}
        </span>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f19; padding: 40px 15px;">
            <tr>
                <td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background: linear-gradient(180deg, #131b2e 0%, #0f172a 100%); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7); overflow: hidden;">
                        <!-- Header / Brand -->
                        <tr>
                            <td style="padding: 36px 36px 20px 36px; text-align: center;">
                                <div style="display: inline-block; padding: 10px 16px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 9999px;">
                                    <span style="font-size: 13px; font-weight: 700; letter-spacing: 2px; color: #818cf8; text-transform: uppercase;">
                                        SECURE VAULT
                                    </span>
                                </div>
                            </td>
                        </tr>

                        <!-- Body Content -->
                        <tr>
                            <td style="padding: 10px 36px 36px 36px; color: #e2e8f0; font-size: 15px; line-height: 1.65;">
                                ${contentHtml}
                            </td>
                        </tr>

                        <!-- Divider -->
                        <tr>
                            <td style="padding: 0 36px;">
                                <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);"></div>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="padding: 24px 36px 32px 36px; text-align: center; color: #64748b; font-size: 12px; line-height: 1.5;">
                                <p style="margin: 0 0 8px 0;">This is an automated security message from Secure Vault.</p>
                                <p style="margin: 0; color: #475569;">&copy; ${new Date().getFullYear()} Secure Vault Inc. All rights reserved.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
};

/**
 * 1. Verification OTP Email
 */
const sendOTPEmail = async (email, otp) => {
    try {
        if (CONSTANTS.OTP.TESTING) {
            logger.info({ email, otp }, 'Testing mode active: OTP generated without dispatching live email');
            return { success: true, data: { otp } };
        }

        const expiryMinutes = Math.round((CONSTANTS.OTP.EXPIRY_MS || 900000) / (60 * 1000));

        const contentHtml = `
            <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 16px 0; text-align: center; letter-spacing: -0.5px;">
                Authentication Code
            </h1>
            <p style="color: #94a3b8; font-size: 15px; margin: 0 0 28px 0; text-align: center;">
                Use the single-use verification code below to authorize your sign-in request.
            </p>

            <!-- OTP Card -->
            <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 28px 0;">
                <div style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #a5b4fc; margin-bottom: 8px;">
                    ${otp}
                </div>
                <div style="color: #64748b; font-size: 13px;">
                    Valid for <strong style="color: #94a3b8;">${expiryMinutes} minutes</strong> &bull; Do not share with anyone
                </div>
            </div>

            <!-- Security Notice -->
            <div style="background: rgba(30, 41, 59, 0.5); border-left: 3px solid #6366f1; padding: 12px 16px; border-radius: 6px; margin: 0 0 10px 0;">
                <p style="margin: 0; color: #94a3b8; font-size: 13px;">
                    If you did not initiate this request, someone may be attempting to access your account. You can safely discard this email or review active sessions in your dashboard.
                </p>
            </div>
        `;

        const html = renderEmailLayout({
            title: 'Your Verification Code - Secure Vault',
            preheader: `Your verification code is ${otp}. Valid for ${expiryMinutes} minutes.`,
            contentHtml
        });

        const { data, error } = await emailClient.send({
            to: email,
            subject: `${otp} is your Secure Vault verification code`,
            html
        });

        if (error) {
            logger.error({ err: error, recipient: email }, 'Email delivery service rejected email dispatch request');
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        logger.error({ err: err.message, recipient: email }, 'Unexpected error encountered while dispatching email');
        return { success: false, error: err };
    }
};

/**
 * 2. Login Alert Notification Email
 */
const sendLoginAlertEmail = async (email, { ip = 'Unknown IP', device = 'Unknown Device', time = new Date().toUTCString() } = {}) => {
    try {
        if (CONSTANTS.OTP.TESTING) {
            logger.info({ email, ip, device }, 'Testing mode active: Login alert generated without dispatching live email');
            return { success: true, data: { ip, device } };
        }

        const contentHtml = `
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; font-size: 22px;">
                    &#9888;
                </div>
                <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 16px 0 8px 0; letter-spacing: -0.5px;">
                    New Sign-In Detected
                </h1>
                <p style="color: #94a3b8; font-size: 14px; margin: 0;">
                    A new session was successfully authenticated for your account.
                </p>
            </div>

            <!-- Details Card -->
            <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
                    <tr>
                        <td style="color: #64748b; padding: 8px 0; width: 35%;">Device / Browser</td>
                        <td style="color: #e2e8f0; font-weight: 600; padding: 8px 0; text-align: right;">${device}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding: 8px 0; border-top: 1px solid rgba(255, 255, 255, 0.05);">IP Address</td>
                        <td style="color: #cbd5e1; font-family: monospace; font-size: 13px; padding: 8px 0; text-align: right; border-top: 1px solid rgba(255, 255, 255, 0.05);">${ip}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding: 8px 0; border-top: 1px solid rgba(255, 255, 255, 0.05);">Timestamp</td>
                        <td style="color: #94a3b8; font-size: 13px; padding: 8px 0; text-align: right; border-top: 1px solid rgba(255, 255, 255, 0.05);">${time}</td>
                    </tr>
                </table>
            </div>

            <!-- Action Prompt -->
            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px; padding: 14px 16px; margin-bottom: 8px;">
                <p style="margin: 0; color: #fca5a5; font-size: 13px; line-height: 1.5;">
                    <strong>Didn't recognize this activity?</strong> Your credentials may be compromised. Please revoke all active sessions and change your master password immediately.
                </p>
            </div>
        `;

        const html = renderEmailLayout({
            title: 'Security Notice: New Login - Secure Vault',
            preheader: `New sign-in detected on ${device} (${ip}).`,
            contentHtml
        });

        const { data, error } = await emailClient.send({
            to: email,
            subject: `Security Alert: New sign-in on ${device}`,
            html
        });

        if (error) {
            logger.error({ err: error, recipient: email }, 'Email delivery service rejected login alert email');
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        logger.error({ err: err.message, recipient: email }, 'Unexpected error encountered while dispatching login alert email');
        return { success: false, error: err };
    }
};

/**
 * 3. Welcome Onboarding Email
 */
const sendWelcomeEmail = async (email, { name = 'there', dashboardUrl } = {}) => {
    try {
        if (CONSTANTS.OTP.TESTING) {
            logger.info({ email, name }, 'Testing mode active: Welcome email generated without dispatching live email');
            return { success: true, data: { email, name } };
        }

        const clientUrl = dashboardUrl || process.env.CLIENT_URL_DEV || 'http://localhost:5173';

        const contentHtml = `
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 16px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; font-size: 26px; box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.5);">
                    &#128274;
                </div>
                <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 18px 0 8px 0; letter-spacing: -0.5px;">
                    Welcome to Secure Vault
                </h1>
                <p style="color: #94a3b8; font-size: 15px; margin: 0;">
                    Hello <strong style="color: #e2e8f0;">${name}</strong>, your encrypted identity is ready.
                </p>
            </div>

            <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
                You've unlocked zero-compromise security with rotating tokens, continuous session tracking, and biometric-grade 2FA controls.
            </p>

            <!-- Feature Highlights Grid -->
            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 20px; margin-bottom: 28px;">
                <div style="margin-bottom: 14px; display: flex; align-items: flex-start;">
                    <span style="color: #818cf8; font-size: 16px; margin-right: 12px;">&#10003;</span>
                    <div>
                        <strong style="color: #f1f5f9; font-size: 14px;">Instant Session Governance</strong>
                        <p style="margin: 2px 0 0 0; color: #64748b; font-size: 13px;">View and revoke active device sessions in real-time.</p>
                    </div>
                </div>
                <div style="margin-bottom: 14px; display: flex; align-items: flex-start;">
                    <span style="color: #818cf8; font-size: 16px; margin-right: 12px;">&#10003;</span>
                    <div>
                        <strong style="color: #f1f5f9; font-size: 14px;">MFA & Login Protection</strong>
                        <p style="margin: 2px 0 0 0; color: #64748b; font-size: 13px;">Always-on verification and suspicious device notifications.</p>
                    </div>
                </div>
                <div style="display: flex; align-items: flex-start;">
                    <span style="color: #818cf8; font-size: 16px; margin-right: 12px;">&#10003;</span>
                    <div>
                        <strong style="color: #f1f5f9; font-size: 14px;">Cryptographic Rotation</strong>
                        <p style="margin: 2px 0 0 0; color: #64748b; font-size: 13px;">Family-versioned refresh tokens with replay-attack defenses.</p>
                    </div>
                </div>
            </div>

            <!-- Call to Action -->
            <div style="text-align: center; margin-bottom: 16px;">
                <a href="${clientUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 14px 32px; border-radius: 8px; box-shadow: 0 8px 16px -4px rgba(99, 102, 241, 0.4);">
                    Open Your Dashboard &rarr;
                </a>
            </div>
        `;

        const html = renderEmailLayout({
            title: 'Welcome to Secure Vault',
            preheader: `Welcome to Secure Vault, ${name}. Your secure identity has been activated.`,
            contentHtml
        });

        const { data, error } = await emailClient.send({
            to: email,
            subject: 'Welcome to Secure Vault - Account Activated',
            html
        });

        if (error) {
            logger.error({ err: error, recipient: email }, 'Email delivery service rejected welcome email');
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        logger.error({ err: err.message, recipient: email }, 'Unexpected error encountered while dispatching welcome email');
        return { success: false, error: err };
    }
};

/**
 * 4. Password Reset Success Notification Email
 */
const sendPasswordResetSuccessEmail = async (email, { time = new Date().toUTCString() } = {}) => {
    try {
        if (CONSTANTS.OTP.TESTING) {
            logger.info({ email }, 'Testing mode active: Password reset success email generated without dispatching live email');
            return { success: true, data: { email, time } };
        }

        const contentHtml = `
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); color: #4ade80; font-size: 22px;">
                    &#10003;
                </div>
                <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 16px 0 8px 0; letter-spacing: -0.5px;">
                    Password Reset Successful
                </h1>
                <p style="color: #94a3b8; font-size: 14px; margin: 0;">
                    Your account password has been updated successfully.
                </p>
            </div>

            <!-- Details Card -->
            <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
                    <tr>
                        <td style="color: #64748b; padding: 8px 0; width: 35%;">Account</td>
                        <td style="color: #e2e8f0; font-weight: 600; padding: 8px 0; text-align: right;">${email}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding: 8px 0; border-top: 1px solid rgba(255, 255, 255, 0.05);">Timestamp</td>
                        <td style="color: #94a3b8; font-size: 13px; padding: 8px 0; text-align: right; border-top: 1px solid rgba(255, 255, 255, 0.05);">${time}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding: 8px 0; border-top: 1px solid rgba(255, 255, 255, 0.05);">Security Action</td>
                        <td style="color: #a5b4fc; font-size: 13px; font-weight: 600; padding: 8px 0; text-align: right; border-top: 1px solid rgba(255, 255, 255, 0.05);">All other sessions revoked</td>
                    </tr>
                </table>
            </div>

            <!-- Security Warning -->
            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px; padding: 14px 16px; margin-bottom: 8px;">
                <p style="margin: 0; color: #fca5a5; font-size: 13px; line-height: 1.5;">
                    <strong>Didn't make this change?</strong> If you did not reset your password, someone may have unauthorized access to your account. Please use the "Forgot Password" option to regain control or contact support immediately.
                </p>
            </div>
        `;

        const html = renderEmailLayout({
            title: 'Security Notice: Password Reset Successful - Secure Vault',
            preheader: 'Your Secure Vault account password was successfully reset.',
            contentHtml
        });

        const { data, error } = await emailClient.send({
            to: email,
            subject: 'Security Notice: Your password has been reset',
            html
        });

        if (error) {
            logger.error({ err: error, recipient: email }, 'Email delivery service rejected password reset notification email');
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        logger.error({ err: err.message, recipient: email }, 'Unexpected error encountered while dispatching password reset email');
        return { success: false, error: err };
    }
};

export {
    sendOTPEmail,
    sendLoginAlertEmail,
    sendWelcomeEmail,
    sendPasswordResetSuccessEmail
};

export default sendOTPEmail;
