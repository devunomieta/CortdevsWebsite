import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { encryptSecret, decryptSecret } from '../../../_lib/eventAuth.js';
import { withinLength, isValidEmail, LIMITS } from '../../../_lib/validation.js';
import { logEventActivity } from '../../../_lib/eventAuditLog.js';

function generatePassword(): string {
    return crypto.randomBytes(9).toString('base64url'); // 12-char, URL-safe
}

// GET ?eventId= : list credentials for an event.
// POST { action: 'issue' | 'revoke' | 'enable' | 'rotate', ... } : manage them.
// One event can have many named credentials (PRD §07) — labeled by staffer/desk,
// each independently full/view-only and whole-event/day-scoped.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        const eventId = String(req.query.eventId || '');
        if (!eventId) return res.status(400).json({ error: 'eventId is required.' });
        const { data, error } = await supabase
            .from('event_credentials')
            .select('id, label, email, role, event_day_id, is_active, created_at')
            .eq('event_id', eventId)
            .order('created_at', { ascending: true });
        if (error) return res.status(500).json({ error: 'Could not load credentials.' });
        return res.status(200).json({ credentials: data || [] });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action } = req.body || {};

    try {
        if (action === 'issue') {
            const { eventId, label, email, role, dayId } = req.body;
            if (!eventId || !label?.trim() || !email) return res.status(400).json({ error: 'eventId, label, and email are required.' });
            if (!withinLength(label, LIMITS.label)) return res.status(400).json({ error: `Label must be ${LIMITS.label} characters or fewer.` });
            if (!isValidEmail(email)) return res.status(400).json({ error: 'That email address doesn\'t look valid.' });

            const password = generatePassword();
            const { data, error } = await supabase
                .from('event_credentials')
                .insert([{
                    event_id: eventId,
                    event_day_id: dayId || null,
                    label: label.trim(),
                    email: String(email).toLowerCase().trim(),
                    password_hash: encryptSecret(password),
                    role: role === 'view_only' ? 'view_only' : 'full',
                    created_by: admin.id,
                }])
                .select('id')
                .single();
            if (error) throw error;

            await logEventActivity({
                eventId,
                actorType: 'admin',
                actorId: admin.id,
                actorLabel: `Admin — ${admin.email}`,
                action: `Issued credential for ${label}`,
            });

            // Password is only ever visible here, in plaintext, right after creation.
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
                .select('event_id, label')
                .single();
            if (error) throw error;

            await logEventActivity({
                eventId: cred.event_id,
                actorType: 'admin',
                actorId: admin.id,
                actorLabel: `Admin — ${admin.email}`,
                action: `${isActive ? 'Re-enabled' : 'Revoked'} credential ${cred.label}`,
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
                .select('event_id, label')
                .single();
            if (error) throw error;

            await logEventActivity({
                eventId: cred.event_id,
                actorType: 'admin',
                actorId: admin.id,
                actorLabel: `Admin — ${admin.email}`,
                action: `Rotated password for ${cred.label} — the old one stopped working immediately`,
            });

            return res.status(200).json({ password });
        }

        // Non-destructive: shows the CURRENT password without changing it, so
        // "I need to check/resend this login" doesn't have to mean "issue a
        // new password" — that conflation was the actual root cause of
        // credentials seeming to break after every use.
        if (action === 'reveal') {
            const { credentialId } = req.body;
            if (!credentialId) return res.status(400).json({ error: 'credentialId is required.' });

            const { data: cred, error } = await supabase
                .from('event_credentials')
                .select('event_id, label, password_hash')
                .eq('id', credentialId)
                .maybeSingle();
            if (error || !cred) return res.status(404).json({ error: 'Credential not found.' });

            const password = decryptSecret(cred.password_hash);
            if (password === null) {
                return res.status(409).json({ error: 'This credential predates readable passwords — rotate it once to fix that.' });
            }

            await logEventActivity({
                eventId: cred.event_id,
                actorType: 'admin',
                actorId: admin.id,
                actorLabel: `Admin — ${admin.email}`,
                action: `Viewed the current password for ${cred.label}`,
            });

            return res.status(200).json({ password });
        }

        return res.status(400).json({ error: 'Unknown action.' });
    } catch (err: any) {
        console.error('admin/events/credentials error:', err);
        return res.status(500).json({ error: err.message || 'Credential operation failed.' });
    }
}
