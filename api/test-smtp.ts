import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resend, getFromAddress } from './_lib/resend.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // We use the configured Resend client. 
        // A successful ping/send to admin verifies the key and relay path.

        const { data, error } = await resend.emails.send({
            from: getFromAddress('System Diagnostic'),
            to: ['projects@cortdevs.com', 'cortdevs@gmail.com'],
            replyTo: 'projects@cortdevs.com',
            subject: 'PROD RELAY DIAGNOSTIC',
            html: `
                <div style="font-family: mono; padding: 20px; border: 1px solid #000;">
                    <h2 style="font-weight: bold; border-bottom: 2px solid #000;">DIAGNOSTIC SIGNAL RECEIVED</h2>
                    <p>STATUS: <strong>OPERATIONAL</strong></p>
                    <p>PROTOCOL: <strong>HTTPS/RESEND-V1</strong></p>
                    <p>TIMESTAMP: ${new Date().toISOString()}</p>
                    <hr/>
                    <p style="font-size: 10px;">This message verifies the integrity of the secure email relay infrastructure.</p>
                </div>
            `
        });

        if (error) {
            console.error('Resend API Error:', error);
            return res.status(500).json({ success: false, error: error.message, details: error });
        }

        return res.status(200).json({ success: true, message: 'Resend Relay connectivity verified. Diagnostic signal dispatched.', id: data?.id });
    } catch (error: any) {
        console.error('Diagnostic Error:', error);
        return res.status(500).json({ error: 'System diagnostic failure.', details: error.message });
    }
}
