import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { logLmsEvent, requireLmsAdmin } from '../../../_lib/lmsGate.js';
import { sendLmsManualNudge } from '../../../_lib/lmsEmail.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const admin = await requireLmsAdmin(req, res);
    if (!admin) return;

    const { action = 'nudge', targetUserId, message, moduleId, lessonId, overrideType, reason } = req.body || {};

    if (action === 'override') {
        if (!['unlock_drip', 'unlock_lesson'].includes(overrideType)) {
            return res.status(400).json({ error: 'overrideType must be unlock_drip or unlock_lesson' });
        }
        const { data, error } = await supabase
            .from('lms_overrides')
            .insert({
                cohort_id: admin.cohort.id,
                user_id: targetUserId || null,
                module_id: moduleId || null,
                lesson_id: lessonId || null,
                override_type: overrideType,
                reason: String(reason || 'Admin override').trim(),
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
            metadata: { overrideType, moduleId, reason },
        });

        return res.status(201).json({ override: data });
    }

    // Default: send a personal nudge email to a learner
    const cleanMsg = String(message || '').trim();
    if (!targetUserId || cleanMsg.length < 5) {
        return res.status(400).json({ error: 'targetUserId and a message are required.' });
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
