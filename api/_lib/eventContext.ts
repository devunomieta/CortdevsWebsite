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
