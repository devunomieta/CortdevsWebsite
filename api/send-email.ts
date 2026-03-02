import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase.js';
import { resend, getFromAddress } from './_lib/resend.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, subject, body, type = 'Direct', attachments = [] } = req.body;

    if (!to || !subject || !body) {
        return res.status(400).json({ error: 'Missing required fields for transmission.' });
    }

    try {
        const mailOptions = {
            from: getFromAddress(),
            to,
            replyTo: 'projects@cortdevs.com',
            subject,
            html: body.includes('<html>') ? body : `
              <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; color: #333;">
                <div style="line-height: 1.6;">
                  ${body}
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0 20px 0;"/>
                <p style="font-size: 10px; color: #ccc; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
                  Transmitted via CortDevs Secure Relay
                </p>
              </div>
            `,
            attachments: attachments.map((file: any) => ({
                filename: file.name,
                path: file.url
            }))
        };

        const { data, error } = await resend.emails.send(mailOptions);

        if (error) throw error;

        // PERSISTENCE: Record this in the messages table
        await supabase
            .from('messages')
            .insert({
                receiver_email: to,
                subject,
                body,
                type,
                is_sent: true,
                created_at: new Date().toISOString()
            });

        return res.status(200).json({ success: true, message: 'Message successfully dispatched via Resend Relay', id: data?.id });
    } catch (error: any) {
        console.error('Resend Transmission Error:', error);
        return res.status(500).json({ error: 'Dispatch failed. Secure relay path unavailable.', details: error.message });
    }
}
