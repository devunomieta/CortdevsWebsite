import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';
import { resend, getFromAddress } from './_lib/resend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, company, phone, service, budget, timeline, message, issueNDA, ndaUrl, attachments, website } = req.body;

  // 1. Honeypot check
  if (website) {
    return res.status(200).json({ success: true, message: 'Transmission successful (bot detected)' });
  }

  // 2. Strict Email Validation (Server-side)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'A valid email address with a TLD is required.' });
  }

  try {
    const adminMailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; color: #333;">
        <h2 style="color: #000; border-bottom: 2px solid #000; padding-bottom: 10px; font-weight: 300; letter-spacing: -1px;">New Project Briefing</h2>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 30px;">
            <p><strong>Client:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Company:</strong> ${company || 'N/A'}</p>
            <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
            <p><strong>Selected Service:</strong> ${service}</p>
            <p><strong>Budget Range:</strong> ${budget || 'N/A'}</p>
            <p><strong>Timeline:</strong> ${timeline || 'N/A'}</p>
        </div>

        <div style="margin-top: 20px; padding: 20px; background: #fdfdfd; border: 1px solid #f0f0f0; border-left: 4px solid #000;">
          <strong style="text-transform: uppercase; font-size: 10px; letter-spacing: 2px; color: #999;">Project Requirements</strong><br/><br/>
          <div style="line-height: 1.6;">${message.replace(/\n/g, '<br/>')}</div>
        </div>

        <div style="margin-top: 30px; padding: 15px; background: #fafafa; border: 1px solid #eee; font-size: 11px;">
          <p style="margin: 0;"><strong>NDA REQUESTED:</strong> ${issueNDA ? 'YES' : 'NO'}</p>
          ${ndaUrl ? `<p style="margin: 5px 0 0 0;"><strong>NDA LINK:</strong> <a href="${ndaUrl}" style="color: #000;">${ndaUrl}</a></p>` : ''}
          ${attachments && attachments.length > 0 ? `
            <p style="margin: 5px 0 0 0;"><strong>ATTACHMENTS:</strong></p>
            <ul style="margin: 5px 0 0 20px; padding: 0;">
              ${attachments.map((url: string) => `<li style="margin-bottom: 3px;"><a href="${url}" style="color: #000;">${url.split('/').pop()}</a></li>`).join('')}
            </ul>
          ` : ''}
        </div>
        
        <p style="margin-top: 40px; font-size: 10px; color: #ccc; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
          Transmitted via CortDevs Secure Portal
        </p>
      </div>
    `;

    // 1. Send Notification to Admin
    await resend.emails.send({
      from: getFromAddress('CortDevs Inbound'),
      to: ['projects@cortdevs.com', 'cortdevs@gmail.com'],
      replyTo: email, // This allows admin to reply directly to the client
      subject: `[LEAD] ${service} - ${name}`,
      html: adminMailHtml,
    });

    // 2. Send Confirmation to User
    await resend.emails.send({
      from: getFromAddress(),
      to: email,
      replyTo: 'projects@cortdevs.com',
      subject: 'We have received your request - CortDevs',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; color: #333;">
          <p>Hello ${name},</p>
          <p>Thank you for reaching out to CortDevs. We have received your project briefing and our team will review it shortly.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
          <p style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Copy of your submission:</p>
          ${adminMailHtml}
        </div>
      `,
    });

    // 3. Log to Supabase
    await supabase.from('messages').insert({
      receiver_email: email,
      subject: `New Project: ${service}`,
      body: adminMailHtml,
      type: 'Lead',
      is_sent: true,
      created_at: new Date().toISOString()
    });

    return res.status(200).json({ success: true, message: 'Transmission successful' });
  } catch (error: any) {
    console.error('Resend Error:', error);
    return res.status(500).json({ error: 'Transmission failed. Secure relay path unavailable.', details: error.message });
  }
}
