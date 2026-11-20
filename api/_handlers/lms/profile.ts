import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { requireLmsMember } from '../../_lib/lmsGate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const member = await requireLmsMember(req, res);
    if (!member) return;

    if (req.method === 'GET') {
        return res.status(200).json({
            enrollment: member.enrollment,
            cohort: member.cohort,
        });
    }

    if (req.method === 'PATCH') {
        const {
            full_name,
            job_role,
            timezone,
            reminder_hour,
            weekend_reminders,
            email_paused_until,
            weekly_commitment_hours,
            onboarding_completed,
        } = req.body || {};

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (typeof full_name === 'string' && full_name.trim()) updates.full_name = full_name.trim();
        if (typeof job_role === 'string') updates.job_role = job_role.trim();
        if (typeof timezone === 'string' && timezone.trim()) updates.timezone = timezone.trim();
        if (reminder_hour !== undefined && Number.isFinite(Number(reminder_hour))) {
            updates.reminder_hour = Math.max(0, Math.min(23, Math.floor(Number(reminder_hour))));
        }
        if (typeof weekend_reminders === 'boolean') updates.weekend_reminders = weekend_reminders;
        if (email_paused_until === null || typeof email_paused_until === 'string') {
            updates.email_paused_until = email_paused_until || null;
        }
        if (weekly_commitment_hours !== undefined && Number.isFinite(Number(weekly_commitment_hours))) {
            updates.weekly_commitment_hours = Math.max(1, Math.min(40, Number(weekly_commitment_hours)));
        }
        if (typeof onboarding_completed === 'boolean') updates.onboarding_completed = onboarding_completed;

        const { data, error } = await supabase
            .from('lms_enrollments')
            .update(updates)
            .eq('id', member.enrollment.id)
            .select('*')
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ enrollment: data, cohort: member.cohort });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
