import dotenv from 'dotenv';
dotenv.config();

/**
 * Generic email delivery client.
 * Dispatches transactional emails via HTTPS API without vendor-specific SDK dependencies.
 */
export const emailClient = {
    /**
     * Send an email to one or more recipients.
     * @param {Object} options
     * @param {string|string[]|Array<{email: string, name?: string}>} options.to - Recipient(s)
     * @param {string} options.subject - Email subject
     * @param {string} [options.html] - HTML content
     * @param {string} [options.htmlContent] - Alternative HTML content key
     * @param {string} [options.text] - Plain text content
     * @param {Object} [options.sender] - Optional custom sender { name, email }
     * @returns {Promise<{ data: any, error: any }>}
     */
    async send({ to, subject, html, htmlContent, text, sender }) {
        const apiKey = process.env.EMAIL_API_KEY || process.env.BREVO_API_KEY;

        if (!apiKey) {
            return {
                data: null,
                error: { message: 'Email API key is not configured' }
            };
        }

        let recipients = [];
        if (typeof to === 'string') {
            recipients = [{ email: to }];
        } else if (Array.isArray(to)) {
            recipients = to.map((item) => (typeof item === 'string' ? { email: item } : item));
        } else if (to && typeof to === 'object' && to.email) {
            recipients = [to];
        }

        const resolvedSender = {
            name: sender?.name || 'Secure Vault',
            email: sender?.email || process.env.SENDER_EMAIL || 'support@securevault.app'
        };

        const bodyContent = {
            sender: resolvedSender,
            to: recipients,
            subject,
            htmlContent: html || htmlContent || ''
        };

        if (text) {
            bodyContent.textContent = text;
        }

        try {
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': apiKey,
                    'content-type': 'application/json'
                },
                body: JSON.stringify(bodyContent)
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                return {
                    data: null,
                    error: data || { message: `Email delivery service returned status ${response.status}` }
                };
            }

            return {
                data,
                error: null
            };
        } catch (err) {
            return {
                data: null,
                error: { message: err.message }
            };
        }
    }
};

export default emailClient;
