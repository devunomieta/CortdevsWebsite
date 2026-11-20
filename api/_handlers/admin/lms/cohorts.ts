import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { requireLmsAdmin } from '../../../_lib/lmsGate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await requireLmsAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        const { data: cohorts } = await supabase
            .from('lms_cohorts')
            .select('*')
            .order('created_at', { ascending: false });
        return res.status(200).json({ activeCohort: admin.cohort, cohorts: cohorts || [] });
    }

    if (req.method === 'PATCH') {
        const { action, start_date, target_end_date, name, pacing_mode, drip_unlock_hour, project_gate_mode, enrollmentId, peerBuddyUserId } = req.body || {};

        // Assign a peer accountability buddy
        if (action === 'assign_buddy' && enrollmentId) {
            const { error } = await supabase
                .from('lms_enrollments')
                .update({ peer_buddy_user_id: peerBuddyUserId || null, updated_at: new Date().toISOString() })
                .eq('id', enrollmentId)
                .eq('cohort_id', admin.cohort.id);
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (typeof name === 'string' && name.trim()) updates.name = name.trim();
        if (typeof start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
            updates.start_date = start_date;
            // Automatically keep target_end_date synced to 12 weeks (84 days) after start_date unless explicitly passed
            if (!target_end_date) {
                const startMs = new Date(`${start_date}T00:00:00Z`).getTime();
                updates.target_end_date = new Date(startMs + 84 * 86400 * 1000).toISOString().slice(0, 10);
            }
        }
        if (typeof target_end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(target_end_date)) updates.target_end_date = target_end_date;
        if (pacing_mode === 'weekly_drip_sequential' || pacing_mode === 'self_paced_sequential') updates.pacing_mode = pacing_mode;
        if (project_gate_mode === 'submit_to_unlock' || project_gate_mode === 'approve_to_unlock') updates.project_gate_mode = project_gate_mode;
        if (drip_unlock_hour !== undefined && Number.isFinite(Number(drip_unlock_hour))) {
            updates.drip_unlock_hour = Math.max(0, Math.min(23, Math.floor(Number(drip_unlock_hour))));
        }

        const { data, error } = await supabase
            .from('lms_cohorts')
            .update(updates)
            .eq('id', admin.cohort.id)
            .select('*')
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ cohort: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
