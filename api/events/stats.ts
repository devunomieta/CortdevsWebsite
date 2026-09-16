import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';
import { verifyEventAccess } from '../_lib/eventAuth.js';

// Full and View-only can both read this (PRD §07, §09).
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await verifyEventAccess(req, res);
    if (!session) return;

    const dayId = String(req.query.dayId || '');
    if (!dayId) return res.status(400).json({ error: 'dayId is required.' });

    try {
        const [{ count: importedCount }, { data: records }] = await Promise.all([
            supabase.from('attendees').select('id', { count: 'exact', head: true }).eq('event_id', session.eventId).eq('source', 'imported'),
            supabase
                .from('attendance_records')
                .select('attendee_id, attendees!inner(source)')
                .eq('event_day_id', dayId),
        ]);

        const checkedIn = records?.length || 0;
        const newRegistrations = (records || []).filter((r: any) => r.attendees?.source === 'walk-in').length;
        const imported = importedCount || 0;
        const checkInRate = imported > 0 ? Math.round((checkedIn / imported) * 100) : 0;

        return res.status(200).json({ checkedIn, newRegistrations, checkInRate });
    } catch (err: any) {
        console.error('events/stats error:', err);
        return res.status(500).json({ error: 'Could not load stats.' });
    }
}
