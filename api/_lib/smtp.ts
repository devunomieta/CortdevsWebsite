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
        secure: Number(port) === 465, // SSL/TLS for 465, STARTTLS for 587
        auth: {
            user,
            pass,
        },
        // Extreme timeouts for slow DNS/Reverse-DNS on server side
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 45000,
        tls: {
            // Bypass potential certificate validation hangs in local dev
            rejectUnauthorized: false,
            // Force TLS version if server is picky
            minVersion: 'TLSv1.2',
            ciphers: 'SSLv3' // Attempt older ciphers if server is legacy
        },
        requireTLS: Number(port) === 587,
        logger: true,
        debug: true,
        pool: false // Disable pooling for debugging to ensure fresh handshake
    });
};

export const getFromAddress = (overrideEmail?: string) => {
    const fromName = process.env.SMTP_FROM_NAME || 'CortDevs System';
    const fromEmail = overrideEmail || process.env.SMTP_USER;
    return `"${fromName}" <${fromEmail}>`;
};
