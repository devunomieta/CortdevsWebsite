import { supabase } from './supabase.js';

// Live updates (PRD §08, §09, §11, plus admin-side notifications) via Supabase
// Realtime Broadcast rather than postgres_changes — the tables have RLS
// enabled with no policies (browsers never query them directly), so a
// replication-based feed would be invisible to the anon-key client anyway.
//
// Per-event channels are named by event UUID (never the human-readable slug,
// and never rendered into the DOM or URL) — a deliberate "not indexable, not
// linked, low value to guess" simplification rather than full Realtime
// Authorization, acceptable for v1.
//
// The admin channel is a single fixed name every logged-in admin subscribes
// to — broadcasting here doesn't leak anything an admin can't already see
// once authenticated, so no per-admin scoping is needed.

async function broadcast(channelName: string, event: string, payload: Record<string, unknown> = {}) {
    const channel = supabase.channel(channelName);
    await channel.subscribe();
    await channel.send({ type: 'broadcast', event, payload: { at: new Date().toISOString(), ...payload } });
    await supabase.removeChannel(channel);
}

// Event dashboard: check-ins, walk-ins, and export/import decisions all
// invalidate whatever that dashboard is currently showing.
export async function broadcastEventUpdate(eventId: string, kind: 'attendance' | 'export' | 'import') {
    await broadcast(`event-${eventId}`, 'update', { kind });
}

// Kept for the existing call sites (attendance.ts, register.ts).
export async function broadcastAttendanceUpdate(eventId: string) {
    await broadcastEventUpdate(eventId, 'attendance');
}

// Admin panel: new export/import requests and retention reminders all land
// here so the sidebar badge and notifications page update without a reload.
// Passing a title lets the admin see what happened via a live toast without
// navigating to the Notifications page first.
export async function broadcastAdminUpdate(title?: string) {
    await broadcast('admin-notifications', 'update', title ? { title } : {});
}
