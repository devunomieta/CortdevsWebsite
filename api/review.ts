import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase.js';
import { resend, getFromAddress } from './_lib/resend.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    name = "Anonymous",
    email = "no-email@provided.com",
    industry = "General",
    highlight = "Service Excellence",
    type = "review",
    rating = 5,
    message = "",
    impact = "N/A",
    isAnonymous = false,
    website
  } = req.body;

  // 1. Honeypot check
  if (website) {
    return res.status(200).json({ success: true, message: 'Feedback transmitted successfully (bot detected)' });
  }

  // 2. Data Sanitization & Protection
  const safeMessage = (message || "").replace(/\n/g, '<br/>');

  try {
    // 0. Configuration check (Hardened)
    if (!resend) {
      return res.status(500).json({ error: 'Feedback transmission failed. Resend API key is missing in production environment.' });
    }
    if (!supabase) {
      return res.status(500).json({ error: 'Feedback transmission failed. Supabase configuration is missing in production environment.' });
    }

    const feedbackHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #000; border-bottom: 2px solid #000; padding-bottom: 10px;">NEW FEEDBACK RECEIVED</h2>
        <p><strong>From:</strong> ${isAnonymous ? 'Anonymous' : name} (${email})</p>
        <p><strong>Type:</strong> ${type}</p>
        <p><strong>Industry:</strong> ${industry}</p>
        <p><strong>Rating:</strong> ${rating}/5 ⭐</p>
        <p><strong>Highlight:</strong> ${highlight}</p>
        <p><strong>Impact:</strong> ${impact}</p>
        <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-left: 4px solid #000;">
          <strong style="font-size: 10px; color: #999;">MESSAGE</strong><br/><br/>
          ${safeMessage}
        </div>
      </div>
    `;

    // 1. Send Notification to Admin
    await resend.emails.send({
      from: getFromAddress('CortDevs Feedback'),
      to: ['projects@cortdevs.com', 'cortdevs@gmail.com'],
      replyTo: email,
      subject: `⭐ New Review: ${rating}/5 from ${isAnonymous ? 'Anonymous' : name}`,
      html: feedbackHtml,
    });

    // 2. Log to Supabase (Review table)
    const { error: dbError } = await supabase.from('reviews').insert({
      name: isAnonymous ? 'Anonymous' : name,
      email,
      industry,
      type,
      rating,
      message: message || "No message provided.",
      highlight,
      impact,
      is_anonymous: isAnonymous,
      is_published: false,
      created_at: new Date().toISOString()
    });

    if (dbError) throw dbError;

    return res.status(200).json({ success: true, message: 'Feedback transmitted successfully' });
  } catch (error: any) {
    console.error('Feedback Error:', error);
    return res.status(500).json({
      error: 'Feedback transmission failed. Secure relay path unavailable.',
      details: error.message
    });
  }
}
