import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyEventAccess, encryptSecret, decryptSecret } from '../../_lib/eventAuth.js';
import { withinLength, isValidEmail, LIMITS } from '../../_lib/validation.js';
import { logEventActivity } from '../../_lib/eventAuditLog.js';

function generatePassword(): string {
    return crypto.randomBytes(9).toString('base64url'); // 12-char, URL-safe
}

// Event Organizer Credential Management (PRD §07) — Organizers can manage staff
// logins (Reception & View-only) for the specific event they manage. All actions
// log audit entries for admins to review.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const session = await verifyEventAccess(req, res, { requireRole: 'organizer' });
    if (!session) return;

    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('event_credentials')
            .select('id, label, email, role, event_day_id, is_active, created_at')
            .eq('event_id', session.eventId)
            .order('created_at', { ascending: true });

        if (error) return res.status(500).json({ error: 'Could not load event logins.' });
        return res.status(200).json({ credentials: data || [] });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action } = req.body || {};

    try {
        if (action === 'issue') {
            const { label, email, role, dayId } = req.body;
            if (!label?.trim() || !email) return res.status(400).json({ error: 'Label and email are required.' });
            if (!withinLength(label, LIMITS.label)) return res.status(400).json({ error: `Label must be ${LIMITS.label} characters or fewer.` });
            if (!isValidEmail(email)) return res.status(400).json({ error: 'That email address doesn\'t look valid.' });

            const targetRole = ['reception', 'view_only', 'organizer'].includes(role) ? role : 'reception';
            const password = generatePassword();

            const { data, error } = await supabase
                .from('event_credentials')
                .insert([{
                    event_id: session.eventId,
                    event_day_id: dayId || null,
                    label: label.trim(),
                    email: String(email).toLowerCase().trim(),
                    password_hash: encryptSecret(password),
                    role: targetRole,
                }])
                .select('id')
                .single();

            if (error) throw error;

            await logEventActivity({
                eventId: session.eventId,
                actorType: 'credential',
                actorId: session.credentialId,
                actorLabel: `${session.label} (Organizer)`,
                action: `Issued ${targetRole === 'reception' ? 'Reception Desk' : 'View-only'} login for ${label.trim()} (${email})`,
            });

            return res.status(200).json({ id: data.id, password });
        }

        if (action === 'revoke' || action === 'enable') {
            const { credentialId } = req.body;
            if (!credentialId) return res.status(400).json({ error: 'credentialId is required.' });

            const isActive = action === 'enable';
            const { data: cred, error } = await supabase
                .from('event_credentials')
                .update({ is_active: isActive, revoked_at: isActive ? null : new Date().toISOString() })
                .eq('id', credentialId)
                .eq('event_id', session.eventId)
                .select('label')
                .single();

            if (error || !cred) return res.status(404).json({ error: 'Credential not found for this event.' });

            await logEventActivity({
                eventId: session.eventId,
                actorType: 'credential',
                actorId: session.credentialId,
                actorLabel: `${session.label} (Organizer)`,
                action: `${isActive ? 'Re-enabled' : 'Revoked'} login for ${cred.label}`,
            });

            return res.status(200).json({ success: true });
        }

        if (action === 'rotate') {
            const { credentialId } = req.body;
            if (!credentialId) return res.status(400).json({ error: 'credentialId is required.' });

            const password = generatePassword();
            const { data: cred, error } = await supabase
                .from('event_credentials')
                .update({ password_hash: encryptSecret(password) })
                .eq('id', credentialId)
                .eq('event_id', session.eventId)
                .select('label')
                .single();

            if (error || !cred) return res.status(404).json({ error: 'Credential not found for this event.' });

            await logEventActivity({
                eventId: session.eventId,
                actorType: 'credential',
                actorId: session.credentialId,
                actorLabel: `${session.label} (Organizer)`,
                action: `Rotated password for ${cred.label}`,
            });

            return res.status(200).json({ password });
        }

        if (action === 'reveal') {
            const { credentialId } = req.body;
            if (!credentialId) return res.status(400).json({ error: 'credentialId is required.' });

            const { data: cred, error } = await supabase
                .from('event_credentials')
                .select('label, password_hash')
                .eq('id', credentialId)
                .eq('event_id', session.eventId)
                .maybeSingle();

            if (error || !cred) return res.status(404).json({ error: 'Credential not found.' });

            const password = decryptSecret(cred.password_hash);
            if (password === null) {
                return res.status(409).json({ error: 'This login password cannot be revealed — rotate it to issue a new one.' });
            }

            await logEventActivity({
                eventId: session.eventId,
                actorType: 'credential',
                actorId: session.credentialId,
                actorLabel: `${session.label} (Organizer)`,
                action: `Viewed current password for ${cred.label}`,
            });

            return res.status(200).json({ password });
        }

        return res.status(400).json({ error: 'Unknown action.' });
    } catch (err: any) {
        console.error('events/credentials error:', err);
        return res.status(500).json({ error: err.message || 'Credential operation failed.' });
    }
}
