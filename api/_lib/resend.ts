import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
    console.error('CRITICAL: RESEND_API_KEY is missing from environment variables.');
}

export const resend = new Resend(resendApiKey);

export const DEFAULT_FROM = process.env.SMTP_FROM_NAME
    ? `${process.env.SMTP_FROM_NAME} <noreply@cortdevs.com>`
    : 'CortDevs System <noreply@cortdevs.com>';

export const DEFAULT_REPLY_TO = 'projects@cortdevs.com';

// Note: Domain verified! Now using noreply@cortdevs.com
export const getFromAddress = (nameOverride?: string) => {
    const name = nameOverride || process.env.SMTP_FROM_NAME || 'CortDevs System';
    return `${name} <noreply@cortdevs.com>`;
};
