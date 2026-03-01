import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { resend, getFromAddress } from '../_lib/resend';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Credential key required for synchronization.' });
    }

    try {
        // 1. Check if user exists (admin only)
        const { data: admin, error: fetchError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('email', email)
            .single();

        if (fetchError || !admin) {
            // For security, do not reveal if email exists
            return res.status(200).json({ success: true, message: 'Synchronization link dispatched to secure node.' });
        }

        // 2. Generate secure token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

        // 3. Store token in Supabase
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                reset_token: token,
                reset_expires: expiresAt
            })
            .eq('id', admin.id);

        if (updateError) throw updateError;

        // 4. Send Email via Resend
        const resetLink = `https://cortdevs.com/admin/reset-password?token=${token}`;

        await resend.emails.send({
            from: getFromAddress('Security Subsystem'),
            to: email,
            replyTo: 'projects@cortdevs.com',
            subject: 'Security Subsystem: Synchronization Key Request',
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #000; border-bottom: 2px solid #000; padding-bottom: 10px; font-weight: 300;">Security Synchronization</h2>
          <p>Hello ${admin.full_name},</p>
          <p>A request has been made to synchronize your administrative credentials. Please use the following high-priority link to complete the process:</p>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${resetLink}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
              SYNCHRONIZE CREDENTIALS
            </a>
          </div>

          <p style="color: #999; font-size: 12px;">This link will expire in 60 minutes. If you did not request this, please contact local security protocols immediately.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
          <p style="font-size: 10px; color: #ccc; text-align: center; text-transform: uppercase;">CortDevs Identity Relay</p>
        </div>
      `,
        });

        // 5. Log security event
        await supabase.from('messages').insert({
            receiver_email: email,
            subject: 'Security Subsystem: Synchronization Key Request',
            body: 'Reset link dispatched via Resend API.',
            type: 'Direct',
            is_sent: true,
            created_at: new Date().toISOString()
        });

        return res.status(200).json({ success: true, message: 'Synchronization link dispatched to secure node.' });
    } catch (error: any) {
        console.error('Reset Error:', error);
        return res.status(500).json({ error: 'Internal synchronization failure. Transmission path unstable.', details: error.message });
    }
}
