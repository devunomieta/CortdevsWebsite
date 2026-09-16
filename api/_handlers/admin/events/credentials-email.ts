import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { encryptSecret, decryptSecret } from '../../../_lib/eventAuth.js';
import { resend, getFromAddress } from '../../../_lib/resend.js';
import { logEventActivity } from '../../../_lib/eventAuditLog.js';

function generatePassword(): string {
    return crypto.randomBytes(9).toString('base64url');
}

// Emails a login link + credential straight to the event's registered address
// (PRD §04, §14 — "copy/paste, or one click to email it"). Non-destructive by
// default: resends the CURRENT password unchanged. Pass { rotate: true }
// only when a fresh password is actually wanted — used to always rotate
// silently, which was the actual cause of logins seeming to break after
// every single use (resending had no choice but to invalidate the old one).
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    const { credentialId, rotate } = req.body || {};
    if (!credentialId) return res.status(400).json({ error: 'credentialId is required.' });

    try {
        const { data: cred, error: credError } = await supabase
            .from('event_credentials')
            .select('email, label, event_id, password_hash')
            .eq('id', credentialId)
            .maybeSingle();
        if (credError || !cred) return res.status(404).json({ error: 'Credential not found.' });

        const { data: event } = await supabase.from('events').select('title, slug').eq('id', cred.event_id).maybeSingle();
        if (!event) return res.status(404).json({ error: 'Event not found.' });

        let password: string;
        if (rotate) {
            password = generatePassword();
            const { error: updateError } = await supabase.from('event_credentials').update({ password_hash: encryptSecret(password) }).eq('id', credentialId);
            if (updateError) throw updateError;
        } else {
            const existing = decryptSecret(cred.password_hash);
            if (existing === null) {
                // Predates the readable-password migration — has to rotate once.
                password = generatePassword();
                await supabase.from('event_credentials').update({ password_hash: encryptSecret(password) }).eq('id', credentialId);
            } else {
                password = existing;
            }
        }

        const loginUrl = `https://events.cortdevs.com/e/${event.slug}`;

        if (resend) {
            await resend.emails.send({
                from: getFromAddress('CortDevs Events'),
                to: cred.email,
                subject: `Your dashboard login for ${event.title}`,
                html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: auto; color: #222;">
            <h2 style="font-weight: 300;">${event.title}</h2>
            <p>You've been given access to this event's attendance dashboard as <strong>${cred.label}</strong>.</p>
            <p><strong>Link:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
            <p><strong>Email:</strong> ${cred.email}<br/><strong>Password:</strong> ${password}</p>
            <p style="color: #888; font-size: 12px;">This link is private — please don't forward it. Contact Cortdevs if you need it revoked or changed.</p>
          </div>
        `,
            });
        }

        await logEventActivity({
            eventId: cred.event_id,
            actorType: 'admin',
            actorId: admin.id,
            actorLabel: `Admin — ${admin.email}`,
            action: rotate ? `Emailed a new password to ${cred.label} (${cred.email})` : `Resent login to ${cred.label} (${cred.email})`,
        });

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('admin/events/credentials-email error:', err);
        return res.status(500).json({ error: 'Could not send login email.' });
    }
}
