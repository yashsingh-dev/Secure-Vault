import resend from '../lib/resend.js';
import { CONSTANTS } from '../config/constants.js';
import { logger } from '../lib/logger.js';

const sendOTPEmail = async (email, otp) => {
    try {
        if (CONSTANTS.OTP.TESTING) {
            logger.info({ email, otp }, 'Testing mode active: OTP generated without dispatching live email');
            return { success: true, data: { otp } };
        }
        const { data, error } = await resend.emails.send({
            from: 'Secure Vault <' + (process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev') + '>',
            to: [email],
            subject: 'Your Secure Vault Verification Code',
            html: `
            <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    <h2 style="color: #333333; text-align: center;">Verification Code</h2>
                    <p style="color: #666666; font-size: 16px; line-height: 1.5;">
                        Hello,
                    </p>
                    <p style="color: #666666; font-size: 16px; line-height: 1.5;">
                        Your verification code for Secure Vault is:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 5px; background-color: #F3F4F6; padding: 10px 20px; border-radius: 5px;">
                            ${otp}
                        </span>
                    </div>
                    <p style="color: #999999; font-size: 14px; text-align: center;">
                        This code will expire in ${CONSTANTS.OTP.EXPIRY_MS / (60 * 1000)} minutes. For your security, please do not share it with anyone.
                    </p>
                    <p style="color: #999999; font-size: 14px; text-align: center;">
                        If you did not request this code, you can safely ignore this email.
                    </p>
                    <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
                    <p style="color: #bbbbbb; font-size: 12px; text-align: center;">
                        &copy; 2026 Secure Vault. All rights reserved.
                    </p>
                </div>
            </div>
            `
        });

        if (error) {
            logger.error({ err: error, recipient: email }, 'Resend service rejected email dispatch request');
            return { success: false, error };
        }

        return { success: true, data };

    } catch (err) {
        logger.error({ err: err.message, recipient: email }, 'Unexpected error encountered while dispatching email');
        return { success: false, error: err };
    }
}

const sendLoginAlertEmail = async (email, { ip = 'Unknown IP', device = 'Unknown Device', time = new Date().toUTCString() } = {}) => {
    try {
        if (CONSTANTS.OTP.TESTING) {
            logger.info({ email, ip, device }, 'Testing mode active: Login alert generated without dispatching live email');
            return { success: true, data: { ip, device } };
        }

        const { data, error } = await resend.emails.send({
            from: 'Secure Vault <' + (process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev') + '>',
            to: [email],
            subject: 'Security Alert: New Sign-In Detected',
            html: `
            <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    <h2 style="color: #1e293b; text-align: center;">New Sign-In Detected</h2>
                    <p style="color: #475569; font-size: 16px; line-height: 1.5;">
                        Hello,
                    </p>
                    <p style="color: #475569; font-size: 16px; line-height: 1.5;">
                        A new sign-in was just recorded on your Secure Vault account:
                    </p>
                    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 15px 20px; border-radius: 8px; margin: 20px 0;">
                        <ul style="color: #334155; line-height: 1.8; margin: 0; padding-left: 20px; font-size: 15px;">
                            <li><strong>Device:</strong> ${device}</li>
                            <li><strong>IP Address:</strong> ${ip}</li>
                            <li><strong>Time:</strong> ${time}</li>
                        </ul>
                    </div>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.5;">
                        If this was you, you can safely ignore this notification. If you did not initiate this login, please change your password immediately.
                    </p>
                    <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
                    <p style="color: #bbbbbb; font-size: 12px; text-align: center;">
                        &copy; 2026 Secure Vault. All rights reserved.
                    </p>
                </div>
            </div>
            `
        });

        if (error) {
            logger.error({ err: error, recipient: email }, 'Resend service rejected login alert email');
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        logger.error({ err: err.message, recipient: email }, 'Unexpected error encountered while dispatching login alert email');
        return { success: false, error: err };
    }
};

export {
    sendOTPEmail,
    sendLoginAlertEmail
};
