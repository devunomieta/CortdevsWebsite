import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, email, company, phone, service, budget, timeline, message, issueNDA } = req.body;

    // Manual SMTP configuration from user
    const transporter = nodemailer.createTransport({
        host: 'mail.cortdevs.com',
        port: 465,
        secure: true, // Use SSL
        auth: {
            user: 'projects@cortdevs.com',
            pass: '@project$@cortdev$@',
        },
    });

    const mailOptions = {
        from: '"CortDevs Web Form" <projects@cortdevs.com>',
        to: 'projects@cortdevs.com, cortdevs@gmail.com',
        subject: `New Project Inquiry: ${service} from ${name}`,
        html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #000; border-bottom: 2px solid #000; padding-bottom: 10px;">New Project Inquiry</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company || 'N/A'}</p>
        <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
        <p><strong>Service:</strong> ${service}</p>
        <p><strong>Budget:</strong> ${budget || 'N/A'}</p>
        <p><strong>Timeline:</strong> ${timeline || 'N/A'}</p>
        <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-left: 4px solid #000;">
          <strong>Project Details:</strong><br/>
          ${message}
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">
          NDA Requested: ${issueNDA ? 'YES' : 'NO'}
        </p>
      </div>
    `,
    };

    try {
        await transporter.sendMail(mailOptions);
        return res.status(200).json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('SMTP Error:', error);
        return res.status(500).json({ error: 'Failed to send email. Please try again later.' });
    }
}
