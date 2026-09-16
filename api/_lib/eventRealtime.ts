import { supabase } from './supabase.js';

// Live multi-device sync (PRD §08, §09, §11) via Supabase Realtime Broadcast
// rather than postgres_changes — the tables have RLS enabled with no policies
// (browsers never query them directly), so a replication-based feed would be
// invisible to the anon-key client anyway. Broadcast channels are named by
// event UUID (never the human-readable slug, and never rendered into the DOM
// or URL), so this is a deliberate "not indexable, not linked, low value to
// guess" simplification rather than full Realtime Authorization — acceptable
// for v1, worth tightening with private channels + RLS on realtime.messages
// if that ever becomes a real concern.
export async function broadcastAttendanceUpdate(eventId: string) {
    const channel = supabase.channel(`event-${eventId}`);
    await channel.subscribe();
    await channel.send({ type: 'broadcast', event: 'attendance:update', payload: { at: new Date().toISOString() } });
    await supabase.removeChannel(channel);
}
