import nodemailer from 'nodemailer';

export const getTransporter = () => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        throw new Error('Missing SMTP configuration in environment variables');
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass,
        },
    });
};

export const getFromAddress = (overrideEmail?: string) => {
    const fromName = process.env.SMTP_FROM_NAME || 'CortDevs System';
    const fromEmail = overrideEmail || process.env.SMTP_USER;
    return `"${fromName}" <${fromEmail}>`;
};
