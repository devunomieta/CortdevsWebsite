import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { isValidUuid, logLmsEvent, requireLmsAdmin, sanitizePlainText, sanitizeSingleLine } from '../../../_lib/lmsGate.js';
import { sendLmsManualNudge } from '../../../_lib/lmsEmail.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const admin = await requireLmsAdmin(req, res);
    if (!admin) return;

    const { action = 'nudge', targetUserId, message, moduleId, lessonId, overrideType, targetWeek, reason } = req.body || {};

    if (action === 'revoke_override') {
        if (!isValidUuid(targetUserId)) {
            return res.status(400).json({ error: 'Valid targetUserId is required to revoke early access.' });
        }

        if (targetWeek === 'all_legacy') {
            const { error } = await supabase
                .from('lms_overrides')
                .delete()
                .eq('cohort_id', admin.cohort.id)
                .eq('user_id', targetUserId)
                .eq('override_type', 'unlock_drip')
                .is('module_id', null);
            if (error) return res.status(500).json({ error: error.message });

            await logLmsEvent({
                cohortId: admin.cohort.id,
                userId: targetUserId,
                eventType: 'admin_override_revoked',
                metadata: { scope: 'all_legacy' },
            });
            return res.status(200).json({ ok: true, revokedScope: 'all_legacy' });
        }

        if (targetWeek === 'all') {
            const { error } = await supabase
                .from('lms_overrides')
                .delete()
                .eq('cohort_id', admin.cohort.id)
                .eq('user_id', targetUserId)
                .eq('override_type', 'unlock_drip');
            if (error) return res.status(500).json({ error: error.message });

            await logLmsEvent({
                cohortId: admin.cohort.id,
                userId: targetUserId,
                eventType: 'admin_override_revoked',
                metadata: { scope: 'all' },
            });
            return res.status(200).json({ ok: true, revokedScope: 'all' });
        }

        const weekNum = Number(targetWeek);
        if (!Number.isInteger(weekNum) || weekNum < 1 || weekNum > 12) {
            return res.status(400).json({ error: 'targetWeek must be 1–12, "all_legacy", or "all".' });
        }

        const { data: weekMods, error: modErr } = await supabase
            .from('lms_modules')
            .select('id')
            .eq('target_week', weekNum);
        if (modErr) return res.status(500).json({ error: modErr.message });

        const modIds = (weekMods || []).map((m: any) => m.id);
        if (modIds.length > 0) {
            const { error: delErr } = await supabase
                .from('lms_overrides')
                .delete()
                .eq('cohort_id', admin.cohort.id)
                .eq('user_id', targetUserId)
                .eq('override_type', 'unlock_drip')
                .in('module_id', modIds);
            if (delErr) return res.status(500).json({ error: delErr.message });
        }

        await logLmsEvent({
            cohortId: admin.cohort.id,
            userId: targetUserId,
            eventType: 'admin_override_revoked',
            metadata: { targetWeek: weekNum, moduleCount: modIds.length },
        });
        return res.status(200).json({ ok: true, revokedWeek: weekNum });
    }

    if (action === 'override') {
        if (!['unlock_drip', 'unlock_lesson'].includes(overrideType)) {
            return res.status(400).json({ error: 'overrideType must be unlock_drip or unlock_lesson' });
        }
        if (targetUserId && !isValidUuid(targetUserId)) return res.status(400).json({ error: 'Invalid targetUserId' });
        if (moduleId && !isValidUuid(moduleId)) return res.status(400).json({ error: 'Invalid moduleId' });
        if (lessonId && !isValidUuid(lessonId)) return res.status(400).json({ error: 'Invalid lessonId' });

        // Week-scoped early drip access for a single learner (creates module-level overrides for that week only)
        if (overrideType === 'unlock_drip' && targetWeek !== undefined && targetWeek !== null) {
            if (!isValidUuid(targetUserId)) {
                return res.status(400).json({ error: 'Valid targetUserId is required for per-week early access.' });
            }
            const weekNum = Number(targetWeek);
            if (!Number.isInteger(weekNum) || weekNum < 1 || weekNum > 12) {
                return res.status(400).json({ error: 'targetWeek must be an integer between 1 and 12.' });
            }

            const { data: weekMods, error: modErr } = await supabase
                .from('lms_modules')
                .select('id')
                .eq('target_week', weekNum);
            if (modErr) return res.status(500).json({ error: modErr.message });
            const modIds = (weekMods || []).map((m: any) => m.id);
            if (!modIds.length) {
                return res.status(404).json({ error: `No modules found for Week ${weekNum}.` });
            }

            // Idempotent replace for this user + week's modules
            await supabase
                .from('lms_overrides')
                .delete()
                .eq('cohort_id', admin.cohort.id)
                .eq('user_id', targetUserId)
                .eq('override_type', 'unlock_drip')
                .in('module_id', modIds);

            const cleanReason = sanitizeSingleLine(reason, 300) || `Early access: Week ${weekNum}`;
            const rowsToInsert = modIds.map((mid: string) => ({
                cohort_id: admin.cohort.id,
                user_id: targetUserId,
                module_id: mid,
                lesson_id: null,
                override_type: 'unlock_drip',
                reason: cleanReason,
                granted_by: admin.user.id,
            }));

            const { data: inserted, error: insErr } = await supabase
                .from('lms_overrides')
                .insert(rowsToInsert)
                .select('*');
            if (insErr) return res.status(500).json({ error: insErr.message });

            await logLmsEvent({
                cohortId: admin.cohort.id,
                userId: targetUserId,
                eventType: 'admin_override',
                metadata: { overrideType: 'unlock_drip', targetWeek: weekNum, moduleCount: modIds.length, reason: cleanReason },
            });

            return res.status(201).json({ ok: true, targetWeek: weekNum, overrides: inserted || [] });
        }

        const cleanReason = sanitizeSingleLine(reason, 300) || 'Admin override';
        const { data, error } = await supabase
            .from('lms_overrides')
            .insert({
                cohort_id: admin.cohort.id,
                user_id: targetUserId || null,
                module_id: moduleId || null,
                lesson_id: lessonId || null,
                override_type: overrideType,
                reason: cleanReason,
                granted_by: admin.user.id,
            })
            .select('*')
            .single();

        if (error) return res.status(500).json({ error: error.message });

        await logLmsEvent({
            cohortId: admin.cohort.id,
            userId: targetUserId || admin.user.id,
            lessonId: lessonId || null,
            eventType: 'admin_override',
            metadata: { overrideType, moduleId, reason: cleanReason },
        });

        return res.status(201).json({ override: data });
    }

    // Default: send a personal nudge email to a learner
    const cleanMsg = sanitizePlainText(message, 2000);
    if (!isValidUuid(targetUserId) || cleanMsg.length < 5) {
        return res.status(400).json({ error: 'Valid targetUserId and message (at least 5 characters) are required.' });
    }

    const { data: learner } = await supabase
        .from('lms_enrollments')
        .select('email, full_name, user_id')
        .eq('cohort_id', admin.cohort.id)
        .eq('user_id', targetUserId)
        .maybeSingle();

    if (!learner) return res.status(404).json({ error: 'Learner not found in cohort.' });

    const sent = await sendLmsManualNudge({
        to: learner.email,
        fullName: learner.full_name,
        senderName: admin.enrollment.full_name || 'Your Team Lead',
        message: cleanMsg,
        cohortId: admin.cohort.id,
        userId: learner.user_id,
    });

    return res.status(200).json({ ok: true, sent });
}
