import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyEventAccess } from '../../_lib/eventAuth.js';

// Everything the dashboard's Analytics tab needs in one call: the existing
// per-day numbers, plus no-shows, an hourly check-in curve for the selected
// day, and a cross-day rollup for multi-day events. Full and view-only both
// read this — it's stats-only, nothing here can change data.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await verifyEventAccess(req, res);
    if (!session) return;

    const dayId = String(req.query.dayId || '');
    if (!dayId) return res.status(400).json({ error: 'dayId is required.' });

    try {
        const { data: event } = await supabase.from('events').select('timezone').eq('id', session.eventId).maybeSingle();
        const timezone = event?.timezone || 'UTC';

        const [{ count: totalGuests }, { data: allDays }] = await Promise.all([
            supabase.from('attendees').select('id', { count: 'exact', head: true }).eq('event_id', session.eventId).eq('source', 'imported'),
            supabase.from('event_days').select('id').eq('event_id', session.eventId),
        ]);

        const allDayIds = (allDays || []).map((d) => d.id);

        const [{ data: dayRecords }, { data: allRecords }] = await Promise.all([
            supabase.from('attendance_records').select('attendee_id, checked_in_at, attendees!inner(source)').eq('event_day_id', dayId),
            supabase.from('attendance_records').select('attendee_id, event_day_id').in('event_day_id', allDayIds.length ? allDayIds : ['00000000-0000-0000-0000-000000000000']),
        ]);

        const checkedIn = dayRecords?.length || 0; // total headcount today, imported + walk-in
        const newRegistrations = (dayRecords || []).filter((r: any) => r.attendees?.source === 'walk-in').length;
        const importedCheckedIn = checkedIn - newRegistrations; // only invited guests, for rate/no-shows below
        const imported = totalGuests || 0;
        // Rate and no-shows compare against the invited list specifically — a
        // walk-in was never "invited," so counting them here would inflate
        // the rate past what it should be (and could mask real no-shows).
        const checkInRate = imported > 0 ? Math.round((importedCheckedIn / imported) * 100) : 0;
        const noShows = Math.max(0, imported - importedCheckedIn);

        // Hourly check-in curve for this day, in the event's own timezone.
        const hourFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone });
        const hourCounts = new Map<string, number>();
        (dayRecords || []).forEach((r) => {
            const hourLabel = hourFormatter.format(new Date(r.checked_in_at)).slice(0, 2) + ':00';
            hourCounts.set(hourLabel, (hourCounts.get(hourLabel) || 0) + 1);
        });
        const hourly = Array.from(hourCounts.entries())
            .map(([hour, count]) => ({ hour, count }))
            .sort((a, b) => a.hour.localeCompare(b.hour));

        // Cross-day rollup — only meaningful with more than one day.
        const uniqueAttendeeIds = new Set((allRecords || []).map((r) => r.attendee_id));
        const crossDay = allDayIds.length > 1
            ? { uniqueAttendees: uniqueAttendeeIds.size, totalCheckins: allRecords?.length || 0 }
            : null;

        return res.status(200).json({
            totalGuests: imported,
            checkedIn,
            newRegistrations,
            checkInRate,
            noShows,
            hourly,
            crossDay,
        });
    } catch (err: any) {
        console.error('events/analytics error:', err);
        return res.status(500).json({ error: 'Could not load analytics.' });
    }
}
