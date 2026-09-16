import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyEventAccess } from '../../_lib/eventAuth.js';
import { phoneSearchCore } from '../../_lib/phone.js';

// Search by name, email, or phone (PRD §08) — Full role only. Phone matching
// normalizes +234/234/0-prefixed numbers to the same core local digits first,
// so "+2348156841952", "2348156841952", and "08156841952" all match each
// other regardless of which form is on file.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await verifyEventAccess(req, res, { requireRole: 'full' });
    if (!session) return;

    const q = String(req.query.q || '').trim();
    const dayId = String(req.query.dayId || '');
    if (!q || !dayId) return res.status(200).json({ results: [] });

    try {
        const orClauses = [`full_name.ilike.%${q}%`, `email.ilike.%${q}%`, `phone.ilike.%${q}%`];
        const phoneCore = phoneSearchCore(q);
        if (phoneCore.length >= 4 && phoneCore !== q) {
            orClauses.push(`phone.ilike.%${phoneCore}%`);
        }

        const { data: attendees, error } = await supabase
            .from('attendees')
            .select('id, full_name, email, phone, source')
            .eq('event_id', session.eventId)
            .or(orClauses.join(','))
            .limit(20);

        if (error) throw error;
        if (!attendees || attendees.length === 0) return res.status(200).json({ results: [] });

        const { data: records } = await supabase
            .from('attendance_records')
            .select('attendee_id, checked_in_at')
            .eq('event_day_id', dayId)
            .in('attendee_id', attendees.map((a) => a.id));

        const checkedInMap = new Map((records || []).map((r) => [r.attendee_id, r.checked_in_at]));

        const results = attendees.map((a) => ({
            id: a.id,
            fullName: a.full_name,
            email: a.email,
            phone: a.phone,
            source: a.source,
            checkedInAt: checkedInMap.get(a.id) || null,
        }));

        return res.status(200).json({ results });
    } catch (err: any) {
        console.error('events/attendees error:', err);
        return res.status(500).json({ error: 'Search failed.' });
    }
}
