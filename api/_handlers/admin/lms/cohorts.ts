import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import {
    getCohortTargetEndDate,
    isValidUuid,
    normalizeWeekExtensions,
    normalizeWeeklyLeads,
    requireLmsAdmin,
    sanitizeSingleLine,
} from '../../../_lib/lmsGate.js';

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
        const {
            action,
            start_date,
            target_end_date,
            name,
            pacing_mode,
            drip_unlock_hour,
            project_gate_mode,
            week_extensions_json,
            weekly_leads_json,
            enrollmentId,
            peerBuddyUserId,
            studyGroupName,
        } = req.body || {};

        // Assign a member to a Study Group / Pod (supports 2, 3, 4+ members per pod)
        if (action === 'set_study_group' && enrollmentId) {
            if (!isValidUuid(enrollmentId)) {
                return res.status(400).json({ error: 'Valid enrollmentId is required.' });
            }
            const cleanGroup = sanitizeSingleLine(studyGroupName, 40) || null;
            const { error } = await supabase
                .from('lms_enrollments')
                .update({
                    study_group_name: cleanGroup,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', enrollmentId)
                .eq('cohort_id', admin.cohort.id);
            if (error) {
                const missingCol = /study_group_name/i.test(error.message);
                return res.status(500).json({
                    error: missingCol
                        ? 'Database column study_group_name not added yet — run the 2-line ALTER TABLE SQL in Supabase SQL Editor first.'
                        : error.message,
                });
            }
            return res.status(200).json({ ok: true, studyGroupName: cleanGroup });
        }

        // Assign a mutual (2-way) peer accountability buddy within the active cohort
        if (action === 'assign_buddy' && enrollmentId) {
            if (!isValidUuid(enrollmentId)) {
                return res.status(400).json({ error: 'Valid enrollmentId is required.' });
            }
            const nowIso = new Date().toISOString();
            const targetPartnerUserId = peerBuddyUserId ? String(peerBuddyUserId).trim() : null;
            if (targetPartnerUserId && !isValidUuid(targetPartnerUserId)) {
                return res.status(400).json({ error: 'Valid peerBuddyUserId is required.' });
            }

            const { data: memberA, error: aErr } = await supabase
                .from('lms_enrollments')
                .select('id, user_id, peer_buddy_user_id')
                .eq('id', enrollmentId)
                .eq('cohort_id', admin.cohort.id)
                .maybeSingle();

            if (aErr || !memberA) {
                return res.status(404).json({ error: 'Cohort member not found.' });
            }

            if (targetPartnerUserId && targetPartnerUserId === memberA.user_id) {
                return res.status(400).json({ error: 'A member cannot be paired with themselves.' });
            }

            // 1. If member A previously had a different partner, cleanly unpair that old partner too
            if (memberA.peer_buddy_user_id && memberA.peer_buddy_user_id !== targetPartnerUserId) {
                await supabase
                    .from('lms_enrollments')
                    .update({ peer_buddy_user_id: null, updated_at: nowIso })
                    .eq('cohort_id', admin.cohort.id)
                    .eq('user_id', memberA.peer_buddy_user_id)
                    .eq('peer_buddy_user_id', memberA.user_id);
            }

            // 2. If unassigning (targetPartnerUserId === null), clear member A and return
            if (!targetPartnerUserId) {
                const { error } = await supabase
                    .from('lms_enrollments')
                    .update({ peer_buddy_user_id: null, updated_at: nowIso })
                    .eq('id', memberA.id)
                    .eq('cohort_id', admin.cohort.id);
                if (error) {
                const missingCol = /study_group_name/i.test(error.message);
                return res.status(500).json({
                    error: missingCol
                        ? 'Database column study_group_name not added yet — run the 2-line ALTER TABLE SQL in Supabase SQL Editor first.'
                        : error.message,
                });
            }
                return res.status(200).json({ ok: true, mutual: true });
            }

            // 3. Verify target partner B exists and is active in this cohort
            const { data: memberB, error: bErr } = await supabase
                .from('lms_enrollments')
                .select('id, user_id, peer_buddy_user_id')
                .eq('cohort_id', admin.cohort.id)
                .eq('user_id', targetPartnerUserId)
                .eq('status', 'active')
                .maybeSingle();

            if (bErr || !memberB) {
                return res.status(404).json({ error: 'Selected study partner is not an active member of this cohort.' });
            }

            // 4. If partner B previously had a different partner C, cleanly unpair C
            if (memberB.peer_buddy_user_id && memberB.peer_buddy_user_id !== memberA.user_id) {
                await supabase
                    .from('lms_enrollments')
                    .update({ peer_buddy_user_id: null, updated_at: nowIso })
                    .eq('cohort_id', admin.cohort.id)
                    .eq('user_id', memberB.peer_buddy_user_id)
                    .eq('peer_buddy_user_id', memberB.user_id);
            }

            // 5. Link A <-> B mutually in parallel
            const [resA, resB] = await Promise.all([
                supabase
                    .from('lms_enrollments')
                    .update({ peer_buddy_user_id: memberB.user_id, updated_at: nowIso })
                    .eq('id', memberA.id)
                    .eq('cohort_id', admin.cohort.id),
                supabase
                    .from('lms_enrollments')
                    .update({ peer_buddy_user_id: memberA.user_id, updated_at: nowIso })
                    .eq('id', memberB.id)
                    .eq('cohort_id', admin.cohort.id),
            ]);

            if (resA.error) return res.status(500).json({ error: resA.error.message });
            if (resB.error) return res.status(500).json({ error: resB.error.message });
            return res.status(200).json({ ok: true, mutual: true });
        }

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (typeof name === 'string') {
            const cleanCohortName = sanitizeSingleLine(name, 140);
            if (cleanCohortName.length >= 2) updates.name = cleanCohortName;
        }
        const effectiveStartDate =
            typeof start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start_date)
                ? start_date
                : admin.cohort.start_date;
        const hasWeekExtensionsUpdate = week_extensions_json !== undefined;
        const effectiveExtensions = hasWeekExtensionsUpdate
            ? normalizeWeekExtensions(week_extensions_json)
            : normalizeWeekExtensions(admin.cohort.week_extensions_json);

        if (typeof start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
            updates.start_date = start_date;
        }
        if (hasWeekExtensionsUpdate) {
            updates.week_extensions_json = effectiveExtensions;
        }
        if (weekly_leads_json !== undefined) {
            const cleanLeads = normalizeWeeklyLeads(weekly_leads_json);
            const leadUserIds = [...new Set(Object.values(cleanLeads))];
            if (leadUserIds.length > 0) {
                const { data: validMembers } = await supabase
                    .from('lms_enrollments')
                    .select('user_id')
                    .eq('cohort_id', admin.cohort.id)
                    .eq('status', 'active')
                    .in('user_id', leadUserIds);
                const validSet = new Set((validMembers || []).map((m: any) => m.user_id));
                const filteredLeads: Record<string, string> = {};
                for (const [wk, uid] of Object.entries(cleanLeads)) {
                    if (validSet.has(uid)) filteredLeads[wk] = uid;
                }
                updates.weekly_leads_json = filteredLeads;
            } else {
                updates.weekly_leads_json = {};
            }
        }
        // Automatically recompute target_end_date whenever start_date or week extensions change
        if ((typeof start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start_date)) || hasWeekExtensionsUpdate) {
            updates.target_end_date = getCohortTargetEndDate(effectiveStartDate, effectiveExtensions);
        }
        if (typeof target_end_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(target_end_date) && !hasWeekExtensionsUpdate) {
            updates.target_end_date = target_end_date;
        }
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
