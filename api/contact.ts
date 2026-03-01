import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { supabase } from './_lib/supabase';
import { getTransporter, getFromAddress } from './_lib/smtp';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, company, phone, service, budget, timeline, message, issueNDA, ndaUrl, attachments } = req.body;

  let transporter;
  try {
    transporter = getTransporter();
  } catch (err: any) {
    console.error('SMTP Setup Error:', err.message);
    return res.status(500).json({ error: 'System configuration error. Please contact support.' });
  }

  const mailOptions = {
    from: getFromAddress(),
    replyTo: email,
    to: 'projects@cortdevs.com, cortdevs@gmail.com',
    subject: `[LEAD] ${service} - ${name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; color: #333;">
        <h2 style="color: #000; border-bottom: 2px solid #000; padding-bottom: 10px; font-weight: 300; letter-spacing: -1px;">New Project Briefing</h2>
        
        <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 10px; margin-bottom: 30px;">
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
          <div style="line-height: 1.6;">${message}</div>
        </div>

        <div style="margin-top: 30px; padding: 15px; background: #fafafa; border: 1px solid #eee; font-size: 11px;">
          <p style="margin: 0;"><strong>NDA REQUESTED:</strong> ${issueNDA ? 'YES' : 'NO'}</p>
          ${ndaUrl ? `<p style="margin: 5px 0 0 0;"><strong>NDA LINK:</strong> <a href="${ndaUrl}" style="color: #000;">${ndaUrl}</a></p>` : ''}
          ${attachments && attachments.length > 0 ? `
            <p style="margin: 5px 0 0 0;"><strong>ATTACHMENTS:</strong></p>
            <ul style="margin: 5px 0 0 20px; padding: 0;">
              ${attachments.map((url: string) => `<li style="margin-bottom: 3px;"><a href="${url}" style="color: #000;">${url}</a></li>`).join('')}
            </ul>
          ` : ''}
        </div>
        
        <p style="margin-top: 40px; font-size: 10px; color: #ccc; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
          Transmitted via CortDevs Secure Portal
        </p>
      </div>
    `,
  };

  try {
    // 1. Send Notification to Admin
    await transporter.sendMail(mailOptions);

    // 2. Send Confirmation to User
    const userMailOptions = {
      from: getFromAddress(),
      to: email,
      subject: `Confirmation: Your Project Briefing - ${name}`,
      html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; color: #333;">
            <p>Dear ${name},</p>
            <p>Thank you for reaching out to CortDevs. We have received your project briefing and our team will review it shortly.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
            <p style="font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Copy of your submission:</p>
            ${mailOptions.html}
          </div>
        `
    };
    await transporter.sendMail(userMailOptions);

    // PERSISTENCE: Record this in the messages table for the Admin Mailbox
    const messageBody = `
      <div style="font-family: inherit; line-height: 1.6;">
        <p><strong> PROJECT BRIEFING</strong> submitted by <span style="color: #000;">${name}</span></p>
        <p><strong>Service:</strong> ${service}</p>
        <p><strong>Budget:</strong> ${budget || 'N/A'}</p>
        <p><strong>Timeline:</strong> ${timeline || 'N/A'}</p>
        
        <div style="margin: 20px 0; padding: 15px; background: #f9f9f9; border-left: 3px solid #000; font-style: italic;">
          <strong style="font-size: 10px; letter-spacing: 1px; color: #999; display: block; margin-bottom: 10px; font-style: normal;">REQUIREMENTS</strong>
          ${message.replace(/\n/g, '<br/>')}
        </div>
        
        <p><strong>NDA Requested:</strong> ${issueNDA ? 'Yes' : 'No'}</p>
        ${ndaUrl ? `<p><strong>NDA Link:</strong> <a href="${ndaUrl}" target="_blank" style="color: #000; text-decoration: underline;">View Document</a></p>` : ''}
        ${attachments && attachments.length > 0 ? `
          <div style="margin-top: 10px;">
            <strong>Attachments:</strong>
            <ul style="margin: 5px 0; padding-left: 20px;">
              ${attachments.map((url: string) => `<li><a href="${url}" target="_blank" style="color: #000; text-decoration: underline;">${url.split('/').pop()}</a></li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `.trim();

    await supabase
      .from('messages')
      .insert({
        receiver_email: email, // Store the client email as the context
        subject: mailOptions.subject,
        body: messageBody,
        type: 'Lead',
        is_sent: true,
        created_at: new Date().toISOString()
      });

    return res.status(200).json({ success: true, message: 'Emails sent and recorded successfully' });
  } catch (error) {
    console.error('SMTP Error:', error);
    return res.status(500).json({ error: 'Failed to complete transmission. Please try again later.' });
  }
}
