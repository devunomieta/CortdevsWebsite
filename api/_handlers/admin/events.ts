import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '.../_lib/supabase.js';
import { verifyAdmin } from '.../_lib/auth.js';
import { uniqueEventSlug } from '.../_lib/slug.js';

// GET: list every event with a rollup of checked-in attendees (admin overview,
// PRD §04/§09 — never a public listing, this is the admin-only surface).
// POST: create a new event (draft/active) plus its day(s).
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
        if (!title || !organizerName || !organizerEmail) {
            return res.status(400).json({ error: 'title, organizerName, and organizerEmail are required.' });
        }
        if (!Array.isArray(days) || days.length === 0 || days.some((d: any) => !d.date || !d.label)) {
            return res.status(400).json({ error: 'At least one day with a date and label is required.' });
        }

        try {
            const slug = await uniqueEventSlug(title);

            const { data: event, error } = await supabase
                .from('events')
                .insert([{
                    title,
                    slug,
                    organizer_name: organizerName,
                    organizer_email: organizerEmail,
                    website_url: websiteUrl || null,
                    flier_url: flierUrl || null,
                    description: description || null,
                    timezone: timezone || 'Africa/Lagos',
                    walkin_fields: walkinFields || [],
                    status: 'active',
                    created_by: admin.id,
                }])
                .select('id, slug')
                .single();

            if (error) throw error;

            const dayRows = days.map((d: any) => ({ event_id: event.id, date: d.date, label: d.label }));

            const { error: daysError } = await supabase.from('event_days').insert(dayRows);
            if (daysError) throw daysError;

            return res.status(200).json({ id: event.id, slug: event.slug });
        } catch (err: any) {
            console.error('admin/events create error:', err);
            return res.status(500).json({ error: err.message || 'Could not create event.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
