import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { host, port, user, password } = req.body;

    if (!host || !port || !user || !password) {
        return res.status(400).json({ error: 'Missing SMTP credentials' });
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass: password,
        },
        connectTimeout: 5000, // 5 second timeout
    } as any);

    try {
        await transporter.verify();
        return res.status(200).json({ success: true, message: 'SMTP connection established successfully.' });
    } catch (error: any) {
        console.error('SMTP Test Error:', error);
        return res.status(500).json({ error: 'Connection failed: ' + (error.message || 'Unknown error') });
    }
}
