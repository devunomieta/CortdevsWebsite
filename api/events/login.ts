import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';
import { verifyPassword, signEventToken, getClientIp } from '../_lib/eventAuth.js';
import { checkLoginLockout, recordLoginAttempt } from '../_lib/rateLimit.js';
import { getEventContext, todayInTimezone } from '../_lib/eventContext.js';
import { logEventActivity } from '../_lib/eventAuditLog.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { slug, email, password } = req.body || {};
    if (!slug || !email || !password) {
        return res.status(400).json({ error: 'Slug, email, and password are required.' });
    }

    const ip = getClientIp(req);
    const normalizedEmail = String(email).toLowerCase().trim();

    try {
        const { data: event } = await supabase
            .from('events')
            .select('id, title, slug, status, timezone, walkin_fields')
            .eq('slug', slug)
            .maybeSingle();

        if (!event || event.status === 'archived') {
            return res.status(404).json({ error: 'This link is not active.' });
        }

        const lockout = await checkLoginLockout(normalizedEmail, ip);
        if (lockout.locked) {
            return res.status(429).json({
                error: 'Too many failed attempts. Try again shortly.',
                retryAfterSeconds: lockout.retryAfterSeconds,
            });
        }

        if (event.status === 'disabled') {
            return res.status(403).json({ error: 'This dashboard has been disabled by a Cortdevs admin.' });
        }

        const { data: credential } = await supabase
            .from('event_credentials')
            .select('id, label, email, password_hash, role, event_day_id, is_active')
            .eq('event_id', event.id)
            .ilike('email', normalizedEmail)
            .maybeSingle();

        if (!credential || !credential.is_active || !verifyPassword(password, credential.password_hash)) {
            await recordLoginAttempt(normalizedEmail, ip, event.id, false);
            return res.status(401).json({ error: 'Invalid login, or this access has been revoked.' });
        }

        // Day-scoped credentials only work on their assigned day (PRD §07).
        if (credential.event_day_id) {
            const { data: day } = await supabase
                .from('event_days')
                .select('date, label')
                .eq('id', credential.event_day_id)
                .maybeSingle();
            if (day && day.date !== todayInTimezone(event.timezone)) {
                await recordLoginAttempt(normalizedEmail, ip, event.id, false);
                return res.status(403).json({ error: `This login is only valid on ${day.label}.` });
            }
        }

        await recordLoginAttempt(normalizedEmail, ip, event.id, true);

        const token = signEventToken({
            credentialId: credential.id,
            eventId: event.id,
            slug: event.slug,
            label: credential.label,
            role: credential.role as 'full' | 'view_only',
        });

        await logEventActivity({
            eventId: event.id,
            actorType: 'credential',
            actorId: credential.id,
            actorLabel: credential.label,
            action: 'Logged in',
            ip,
        });

        const { days } = await getEventContext(event.id);

        return res.status(200).json({
            token,
            session: { label: credential.label, role: credential.role },
            event: { id: event.id, title: event.title, slug: event.slug, walkinFields: event.walkin_fields },
            days,
        });
    } catch (err: any) {
        console.error('events/login error:', err);
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
}
