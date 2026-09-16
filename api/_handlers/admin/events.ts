import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAdmin } from '../../_lib/auth.js';
import { uniqueEventSlug } from '../../_lib/slug.js';
import { isNonEmpty, withinLength, isValidEmail, isValidUrl, isValidDateString, isValidFieldName, LIMITS } from '../../_lib/validation.js';

// GET: list every event with a rollup of checked-in attendees (admin overview,
// PRD §04/§09 — never a public listing, this is the admin-only surface).
// POST: create a new event (draft/active) plus its day(s).
// DELETE ?id= : permanently removes the event and everything under it
// (event_days, event_credentials, attendees, attendance_records, export/import
// requests, audit log — all `on delete cascade`). Irreversible; the frontend
// gates this behind an explicit confirmation.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET' && req.query.id) {
        try {
            const [{ data: event, error }, { data: days }] = await Promise.all([
                supabase.from('events').select('*').eq('id', String(req.query.id)).maybeSingle(),
                supabase.from('event_days').select('id, date, label').eq('event_id', String(req.query.id)).order('date', { ascending: true }),
            ]);
            if (error || !event) return res.status(404).json({ error: 'Event not found.' });
            return res.status(200).json({ event, days: days || [] });
        } catch (err: any) {
            console.error('admin/events get error:', err);
            return res.status(500).json({ error: 'Could not load event.' });
        }
    }

    if (req.method === 'GET') {
        try {
            const { data: events, error } = await supabase
                .from('events')
                .select('id, title, slug, organizer_name, status, created_at')
                .order('created_at', { ascending: false });
            if (error) throw error;

            const eventIds = (events || []).map((e) => e.id);
            const [{ data: days }, { data: records }] = await Promise.all([
                supabase.from('event_days').select('id, event_id').in('event_id', eventIds.length ? eventIds : ['00000000-0000-0000-0000-000000000000']),
                supabase.from('attendance_records').select('id, event_day_id').limit(50000),
            ]);

            const dayIdsByEvent = new Map<string, Set<string>>();
            (days || []).forEach((d) => {
                if (!dayIdsByEvent.has(d.event_id)) dayIdsByEvent.set(d.event_id, new Set());
                dayIdsByEvent.get(d.event_id)!.add(d.id);
            });

            const checkedInByEvent = new Map<string, number>();
            (records || []).forEach((r) => {
                for (const [eventId, dayIds] of dayIdsByEvent.entries()) {
                    if (dayIds.has(r.event_day_id)) {
                        checkedInByEvent.set(eventId, (checkedInByEvent.get(eventId) || 0) + 1);
                        break;
                    }
                }
            });

            const enriched = (events || []).map((e) => ({
                ...e,
                dayCount: dayIdsByEvent.get(e.id)?.size || 0,
                checkedIn: checkedInByEvent.get(e.id) || 0,
            }));

            return res.status(200).json({ events: enriched });
        } catch (err: any) {
            console.error('admin/events list error:', err);
            return res.status(500).json({ error: 'Could not load events.' });
        }
    }

    if (req.method === 'POST') {
        const { title, organizerName, organizerEmail, websiteUrl, flierUrl, description, timezone, days, walkinFields } = req.body || {};
        if (!isNonEmpty(title) || !isNonEmpty(organizerName) || !isNonEmpty(organizerEmail)) {
            return res.status(400).json({ error: 'title, organizerName, and organizerEmail are required.' });
        }
        if (!withinLength(title, LIMITS.title)) return res.status(400).json({ error: `Title must be ${LIMITS.title} characters or fewer.` });
        if (!withinLength(organizerName, LIMITS.name)) return res.status(400).json({ error: `Organizer name must be ${LIMITS.name} characters or fewer.` });
        if (!isValidEmail(organizerEmail)) return res.status(400).json({ error: 'Organizer email doesn\'t look valid.' });
        if (websiteUrl && (!isValidUrl(websiteUrl) || !withinLength(websiteUrl, LIMITS.url))) {
            return res.status(400).json({ error: 'Website URL must be a valid http(s) link.' });
        }
        if (description && !withinLength(description, LIMITS.description)) {
            return res.status(400).json({ error: `Description must be ${LIMITS.description} characters or fewer.` });
        }
        if (!Array.isArray(days) || days.length === 0 || days.some((d: any) => !isValidDateString(d.date) || !isNonEmpty(d.label) || !withinLength(d.label, LIMITS.label))) {
            return res.status(400).json({ error: 'Every day needs a valid date and a label under 60 characters.' });
        }
        if (walkinFields && (!Array.isArray(walkinFields) || walkinFields.some((f: any) => !isValidFieldName(f)))) {
            return res.status(400).json({ error: 'Custom field names can only use letters, numbers, spaces, and basic punctuation, up to 40 characters.' });
        }

        try {
            const slug = await uniqueEventSlug(title);

            const { data: event, error } = await supabase
                .from('events')
                .insert([{
                    title: title.trim(),
                    slug,
                    organizer_name: organizerName.trim(),
                    organizer_email: organizerEmail.trim().toLowerCase(),
                    website_url: websiteUrl || null,
                    flier_url: flierUrl || null,
                    description: description || null,
                    timezone: timezone || 'Africa/Lagos',
                    walkin_fields: (walkinFields || []).map((f: string) => f.trim()),
                    status: 'active',
                    created_by: admin.id,
                }])
                .select('id, slug')
                .single();

            if (error) throw error;

            const dayRows = days.map((d: any) => ({ event_id: event.id, date: d.date, label: d.label.trim() }));

            const { error: daysError } = await supabase.from('event_days').insert(dayRows);
            if (daysError) throw daysError;

            return res.status(200).json({ id: event.id, slug: event.slug });
        } catch (err: any) {
            console.error('admin/events create error:', err);
            return res.status(500).json({ error: err.message || 'Could not create event.' });
        }
    }

    if (req.method === 'DELETE') {
        const eventId = String(req.query.id || '');
        if (!eventId) return res.status(400).json({ error: 'id is required.' });

        try {
            const { data: event } = await supabase.from('events').select('title, flier_url').eq('id', eventId).maybeSingle();
            if (!event) return res.status(404).json({ error: 'Event not found.' });

            const { error } = await supabase.from('events').delete().eq('id', eventId);
            if (error) throw error;

            // Best-effort cleanup of the flier — not fatal if it fails or was never set.
            if (event.flier_url) {
                const match = event.flier_url.match(/\/assets\/(.+)$/);
                if (match) await supabase.storage.from('assets').remove([decodeURIComponent(match[1])]).catch(() => { });
            }

            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('admin/events delete error:', err);
            return res.status(500).json({ error: err.message || 'Could not delete event.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
