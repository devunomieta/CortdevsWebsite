import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { supabase } from './_lib/supabase';
import { getTransporter, getFromAddress } from './_lib/smtp';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, industry, highlight, type, rating, message, impact, isAnonymous } = req.body;

  let transporter;
  try {
    transporter = getTransporter();
  } catch (err: any) {
    console.error('SMTP Setup Error:', err.message);
    return res.status(500).json({ error: 'System configuration error. Please contact support.' });
  }

  const subject = type === 'complaint'
    ? `🚨 URGENT: New Complaint from ${isAnonymous ? 'Anonymous' : name}`
    : `⭐ New Review: ${rating} Stars from ${isAnonymous ? 'Anonymous' : name}`;

  const mailOptions = {
    from: getFromAddress(),
    to: 'projects@cortdevs.com, cortdevs@gmail.com',
    subject: subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #000; border-bottom: 2px solid #000; padding-bottom: 10px;">
          ${type.toUpperCase()} SUBMISSION
        </h2>
        <p><strong>From:</strong> ${isAnonymous ? 'Anonymous' : name}</p>
        <p><strong>Email:</strong> ${email} (Internal Only)</p>
        <p><strong>Industry:</strong> ${industry || 'N/A'}</p>
        <p><strong>Primary Highlight:</strong> ${highlight || 'N/A'}</p>
        ${type === 'review' ? `<p><strong>Rating:</strong> ${rating} / 5</p>` : ''}
        <div style="margin-top: 20px; padding: 15px; background: #fdfdfd; border: 1px solid #f0f0f0; border-left: 4px solid #000;">
          <strong style="text-transform: uppercase; font-size: 10px; letter-spacing: 2px; color: #999;">Message Content</strong><br/><br/>
          <div style="line-height: 1.6;">${message}</div>
        </div>
        <p style="margin-top: 15px;"><strong>Impact/Result:</strong> ${impact || 'N/A'}</p>
        <p style="margin-top: 20px; font-size: 10px; color: #999; text-transform: uppercase;">
          Privacy Mode: ${isAnonymous ? 'Strict Anonymity' : 'Public Display Allowed'}
        </p>
        <p style="margin-top: 40px; font-size: 10px; color: #ccc; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
          Transmitted via CortDevs Feedback Engine
        </p>
      </div>
    `,
  };

  try {
    // 1. Send Notification to Admin
    await transporter.sendMail(mailOptions);

    // 2. Send Confirmation to User (if not anonymous)
    if (!isAnonymous && email) {
      const userMailOptions = {
        from: getFromAddress(),
        to: email,
        subject: `Confirmation: Your ${type} has been received`,
        html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; color: #333;">
                <p>Hello ${name},</p>
                <p>Thank you for your feedback. We have received your ${type} and our team has been notified.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
                ${mailOptions.html}
              </div>
            `
      };
      await transporter.sendMail(userMailOptions);
    }

    // 3. PERSISTENCE: Record this in the messages table
    const messageBody = `
      <div style="font-family: inherit; line-height: 1.6;">
        <p><strong>${type.toUpperCase()}</strong> submitted by <span style="color: #000;">${isAnonymous ? 'Anonymous' : name}</span></p>
        <p><strong>Email:</strong> ${email || 'Internal'}</p>
        <p><strong>Industry:</strong> ${industry || 'N/A'}</p>
        <p><strong>Highlight:</strong> ${highlight || 'N/A'}</p>
        ${type === 'review' ? `<p><strong>Rating:</strong> <span style="color: #f59e0b;">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span> (${rating}/5)</p>` : ''}
        
        <div style="margin: 20px 0; padding: 15px; background: #f9f9f9; border-left: 3px solid #000; font-style: italic;">
          <strong style="font-size: 10px; letter-spacing: 1px; color: #999; display: block; margin-bottom: 10px; font-style: normal;">MESSAGE CONTENT</strong>
          ${message.replace(/\n/g, '<br/>')}
        </div>
        
        <p><strong>Impact:</strong> ${impact || 'N/A'}</p>
        <p><strong>Privacy Mode:</strong> ${isAnonymous ? 'Strict Anonymity' : 'Public Display'}</p>
      </div>
    `.trim();

    await supabase
      .from('messages')
      .insert({
        receiver_email: email || 'anonymous@cortdevs.local',
        subject: subject,
        body: messageBody,
        type: type === 'complaint' ? 'Direct' : 'Review',
        is_sent: true,
        created_at: new Date().toISOString()
      });

    return res.status(200).json({ success: true, message: 'Feedback transmitted and recorded successfully' });
  } catch (error) {
    console.error('SMTP Error:', error);
    return res.status(500).json({ error: 'Transmission failed. Please try again later.' });
  }
}
