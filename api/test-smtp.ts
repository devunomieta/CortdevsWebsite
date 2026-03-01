import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { supabase } from './_lib/supabase';
import { getFromAddress } from './_lib/smtp';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Try to get body params first (for manual testing), 
    // but default to Environment settings if none provided
    const { host: reqHost, port: reqPort, user: reqUser, password: reqPassword } = req.body;

    let host = reqHost || process.env.SMTP_HOST;
    let port = reqPort || process.env.SMTP_PORT;
    let user = reqUser || process.env.SMTP_USER;
    let password = reqPassword || process.env.SMTP_PASS;

    if (!host || !port || !user || !password) {
        return res.status(400).json({ error: 'Missing SMTP credentials in request or environment' });
    }

    const transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: {
            user,
            pass: password,
        },
        connectTimeout: 10000,
    } as any);

    try {
        await transporter.verify();

        // Test a real mail send if possible
        await transporter.sendMail({
            from: getFromAddress(user), // Use the specific user for test
            to: user, // Send to self
            subject: 'SMTP Connectivity Test',
            text: 'This is a test email to verify SMTP configuration.',
        });

        return res.status(200).json({ success: true, message: 'SMTP connection and test mail validated.' });
    } catch (error: any) {
        console.error('SMTP Test Error:', error);
        return res.status(500).json({ error: 'Connection failed: ' + (error.message || 'Unknown error') });
    }
}
