import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';
import { getTransporter, getFromAddress } from './_lib/smtp';
import { emailTemplates } from './_lib/email-templates';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, subject, body, templateId, templateData, type = 'Direct', attachments = [] } = req.body;

    let finalSubject = subject;
    let finalBody = body;

    // Handle template if provided
    if (templateId && emailTemplates[templateId]) {
        const template = emailTemplates[templateId];
        finalSubject = template.subject;

        // Simple placeholder replacement for subject
        if (templateData) {
            Object.keys(templateData).forEach(key => {
                finalSubject = finalSubject.replace(new RegExp(`{{${key}}}`, 'g'), templateData[key]);
            });
        }

        finalBody = template.html(templateData || {});
    }

    if (!to || !finalSubject || !finalBody) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    let transporter;
    try {
        transporter = getTransporter();
    } catch (err: any) {
        console.error('SMTP Setup Error:', err.message);
        return res.status(500).json({ error: 'System configuration error. Please contact support.' });
    }

    const mailOptions = {
        from: getFromAddress(),
        to,
        subject: finalSubject,
        html: finalBody.includes('<html>') ? finalBody : `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; color: #333;">
        <div style="line-height: 1.6;">
          ${finalBody}
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0 20px 0;"/>
        <p style="font-size: 10px; color: #ccc; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
          Transmitted via CortDevs Professional Portal
        </p>
      </div>
    `,
        attachments: attachments.map((file: any) => ({
            filename: file.name,
            path: file.url
        }))
    };

    try {
        await transporter.sendMail(mailOptions);

        // PERSISTENCE: Record this in the messages table
        await supabase
            .from('messages')
            .insert({
                receiver_email: to,
                subject: finalSubject,
                body: finalBody,
                type: templateId ? `Template: ${templateId}` : type,
                is_sent: true,
                created_at: new Date().toISOString()
            });

        return res.status(200).json({ success: true, message: 'Email sent and recorded successfully' });
    } catch (error) {
        console.error('SMTP Error:', error);
        return res.status(500).json({ error: 'Failed to send email. Please check your SMTP configuration.' });
    }
}
