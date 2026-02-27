import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, email, industry, highlight, type, rating, message, impact, isAnonymous } = req.body;

    const transporter = nodemailer.createTransport({
        host: 'mail.cortdevs.com',
        port: 465,
        secure: true,
        auth: {
            user: 'projects@cortdevs.com',
            pass: '@project$@cortdev$@',
        },
    });

    const subject = type === 'complaint'
        ? `🚨 URGENT: New Complaint from ${isAnonymous ? 'Anonymous' : name}`
        : `⭐ New Review: ${rating} Stars from ${isAnonymous ? 'Anonymous' : name}`;

    const mailOptions = {
        from: '"CortDevs Feedback" <projects@cortdevs.com>',
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
        <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-left: 4px solid #000;">
          <strong>Message:</strong><br/>
          ${message}
        </div>
        <p style="margin-top: 15px;"><strong>Impact/Result:</strong> ${impact || 'N/A'}</p>
        <p style="margin-top: 20px; font-size: 10px; color: #999; text-transform: uppercase;">
          Privacy Mode: ${isAnonymous ? 'Strict Anonymity' : 'Public Display Allowed'}
        </p>
      </div>
    `,
    };

    try {
        await transporter.sendMail(mailOptions);
        return res.status(200).json({ success: true, message: 'Feedback transmitted successfully' });
    } catch (error) {
        console.error('SMTP Error:', error);
        return res.status(500).json({ error: 'Transmission failed. Please try again later.' });
    }
}
