import { supabase } from './supabase.js';

export async function getEventContext(eventId: string) {
    const [{ data: event }, { data: days }] = await Promise.all([
        supabase.from('events').select('id, title, slug, timezone, status, walkin_fields').eq('id', eventId).maybeSingle(),
        supabase.from('event_days').select('id, date, label').eq('event_id', eventId).order('date', { ascending: true }),
    ]);
    return { event, days: days || [] };
}

// Returns today's date (YYYY-MM-DD) in the event's own timezone, used to
// enforce day-scoped credentials (PRD §07: "a hard boundary so yesterday's
// login stops working today").
export function todayInTimezone(timezone: string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC' }).format(new Date());
}

// Check-in and walk-in registration are only allowed on a day's own actual
// calendar date (in the event's timezone) — browsing/switching tabs to see
// other days is still fine, but confirming attendance against the wrong day
// isn't, since that would misrecord who showed up when.
export async function assertIsEventDay(eventId: string, dayId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const [{ data: day }, { data: event }] = await Promise.all([
        supabase.from('event_days').select('date, label').eq('id', dayId).eq('event_id', eventId).maybeSingle(),
        supabase.from('events').select('timezone').eq('id', eventId).maybeSingle(),
    ]);
    if (!day) return { ok: false, error: 'That day was not found for this event.' };

    const today = todayInTimezone(event?.timezone || 'UTC');
    if (day.date === today) return { ok: true };

    const isPast = day.date < today;
    return {
        ok: false,
        error: isPast
            ? `${day.label} has already passed — check-in is closed for that day.`
            : `${day.label} hasn't started yet — check-in opens on its actual date.`,
    };
}
