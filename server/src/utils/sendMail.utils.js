import resend from '../lib/resend.js';

const sendTokenEmail = async (email, otp) => {
    try {
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
                        This code is valid for a limited time. Please do not share it with anyone.
                    </p>
                    <p style="color: #999999; font-size: 14px; text-align: center;">
                        If you did not request this code, please ignore this email.
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
            console.error('Resend Error:', error);
            return { success: false, error };
        }

        return { success: true, data };

    } catch (err) {
        console.error('Email Sending Error:', err);
        return { success: false, error: err };
    }
}

export default sendTokenEmail;
