import { supabase } from './supabase.js';

// Every sensitive SplitSubs action gets a timestamped, attributed row here
// (PRD "Admin Management Dashboard — Audit log"): catalog edits, listing
// moderation, manual payout overrides, dispute resolutions, and every
// joiner-field/credential reveal a host or admin performs.
export async function logSplitsubsActivity(params: {
    actorType: 'admin' | 'host' | 'joiner' | 'system';
    actorId: string | null;
    actorLabel: string;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
}) {
    await supabase.from('ss_audit_log').insert([
        {
            actor_type: params.actorType,
            actor_id: params.actorId,
            actor_label: params.actorLabel,
            action: params.action,
            target_type: params.targetType || null,
            target_id: params.targetId || null,
            metadata: params.metadata || {},
        },
    ]);
}
