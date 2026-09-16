import { supabase } from './supabase.js';

// Every dashboard action gets a timestamped, attributed row here (PRD §07,
// §12) — logins, searches, check-ins, walk-ins, export requests/decisions,
// credential changes, purges. `created_at` defaults to now() in the schema,
// so the timestamp is always the moment the row lands, not client-supplied.
export async function logEventActivity(params: {
    eventId: string;
    actorType: 'admin' | 'credential' | 'system';
    actorId: string | null;
    actorLabel: string;
    action: string;
    meta?: Record<string, unknown>;
    ip?: string;
}) {
    await supabase.from('event_audit_log').insert([
        {
            event_id: params.eventId,
            actor_type: params.actorType,
            actor_id: params.actorId,
            actor_label: params.actorLabel,
            action: params.action,
            meta: params.meta || {},
            ip: params.ip || null,
        },
    ]);
}
