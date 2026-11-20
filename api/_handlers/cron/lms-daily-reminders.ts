import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { isModuleDripUnlocked } from '../../_lib/lmsGate.js';
import { sendLmsDailyReminder, sendLmsInactivityNudge } from '../../_lib/lmsEmail.js';

/**
 * Daily Learning Reminder & Inactivity Escalation Cron (07:00 UTC = 08:00 WAT).
 * Gated by CRON_SECRET.
 * - Skips learners who already completed >= 1 lesson today, paused emails, or have finished all currently dripped modules.
 * - Sends standard Daily Reminder OR Day 3 / 5 / 7 Inactivity Escalation (CC'ing cohort admins on Day 7).
 */
const MAX_DAILY_EMAILS = 80; // Keeps 20/day headroom under Resend Free's 100 emails/day cap

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const now = new Date();
        const todayIso = now.toISOString().slice(0, 10);
        const dayOfWeekUtc = now.getUTCDay(); // 0 = Sun, 6 = Sat
        const isWeekend = dayOfWeekUtc === 0 || dayOfWeekUtc === 6;

        const { data: cohorts } = await supabase.from('lms_cohorts').select('*').eq('is_active', true);
        if (!cohorts?.length) return res.status(200).json({ ok: true, remindersSent: 0, nudgesSent: 0 });

        const [{ data: modules }, { data: lessons }] = await Promise.all([
            supabase.from('lms_modules').select('id, title, target_week, global_order').order('global_order', { ascending: true }),
            supabase
                .from('lms_lessons')
                .select('id, module_id, title, global_order, estimated_minutes')
                .order('global_order', { ascending: true }),
        ]);

        const modMap = new Map<string, any>();
        for (const m of modules || []) modMap.set(m.id, m);
        const allLessons = lessons || [];

        let remindersSent = 0;
        let nudgesSent = 0;

        for (const cohort of cohorts) {
            const [{ data: enrollments }, { data: progressRows }] = await Promise.all([
                supabase.from('lms_enrollments').select('*').eq('cohort_id', cohort.id).eq('status', 'active'),
                supabase
                    .from('lms_lesson_progress')
                    .select('user_id, lesson_id, status, completed_at')
                    .eq('cohort_id', cohort.id)
                    .eq('status', 'completed'),
            ]);

            if (!enrollments?.length) continue;

            const adminEmails = enrollments.filter((e: any) => e.role === 'admin').map((e: any) => e.email);

            // Calculate how many lessons are currently eligible via Monday drip
            const eligibleLessonCount = allLessons.filter((l: any) => {
                const mod = modMap.get(l.module_id);
                return isModuleDripUnlocked(cohort, mod?.target_week || 1, now, false).unlocked;
            }).length;
            const targetPct = allLessons.length > 0 ? Math.round((eligibleLessonCount / allLessons.length) * 100) : 0;

            const doneByUser = new Map<string, { set: Set<string>; doneToday: boolean }>();
            for (const p of progressRows || []) {
                const entry = doneByUser.get(p.user_id) || { set: new Set<string>(), doneToday: false };
                entry.set.add(p.lesson_id);
                if (p.completed_at && String(p.completed_at).slice(0, 10) === todayIso) {
                    entry.doneToday = true;
                }
                doneByUser.set(p.user_id, entry);
            }

            for (const enr of enrollments) {
                if (remindersSent + nudgesSent >= MAX_DAILY_EMAILS) break;
                if (enr.email_paused_until && enr.email_paused_until >= todayIso) continue;
                if (isWeekend && !enr.weekend_reminders) continue;

                const userDone = doneByUser.get(enr.user_id) || { set: new Set<string>(), doneToday: false };
                if (userDone.doneToday) continue; // Already studied today!

                // Find next unlocked lesson that is ALSO drip-eligible
                const nextLesson = allLessons.find((l: any) => {
                    if (userDone.set.has(l.id)) return false;
                    const mod = modMap.get(l.module_id);
                    return isModuleDripUnlocked(cohort, mod?.target_week || 1, now, enr.role === 'admin').unlocked;
                });

                if (!nextLesson) continue; // Learner is 100% caught up for this week's drip!

                const nextMod = modMap.get(nextLesson.module_id);
                const progressPct = allLessons.length > 0 ? Math.round((userDone.set.size / allLessons.length) * 100) : 0;

                const lastActiveMs = enr.last_active_at
                    ? new Date(enr.last_active_at).getTime()
                    : new Date(enr.created_at).getTime();
                const daysInactive = Math.max(0, Math.floor((now.getTime() - lastActiveMs) / 86400000));

                if (daysInactive === 3 || daysInactive === 5 || daysInactive === 7) {
                    const sent = await sendLmsInactivityNudge({
                        to: enr.email,
                        ccAdmins: daysInactive >= 7 ? adminEmails : undefined,
                        fullName: enr.full_name,
                        daysInactive,
                        nextLessonTitle: nextLesson.title,
                        nextLessonId: nextLesson.id,
                        cohortId: cohort.id,
                        userId: enr.user_id,
                        dateKey: todayIso,
                    });
                    if (sent) nudgesSent += 1;
                } else {
                    const sent = await sendLmsDailyReminder({
                        to: enr.email,
                        fullName: enr.full_name,
                        nextLessonTitle: nextLesson.title,
                        nextLessonId: nextLesson.id,
                        nextLessonMinutes: nextLesson.estimated_minutes || 15,
                        moduleTitle: nextMod?.title || 'Current Module',
                        progressPct,
                        targetPct,
                        streak: enr.current_streak || 0,
                        cohortId: cohort.id,
                        userId: enr.user_id,
                        dateKey: todayIso,
                    });
                    if (sent) remindersSent += 1;
                }
            }
        }

        return res.status(200).json({ ok: true, remindersSent, nudgesSent });
    } catch (err: any) {
        console.error('[cron/lms-daily-reminders] Error:', err);
        return res.status(500).json({ error: err?.message || 'Cron failed' });
    }
}
