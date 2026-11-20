import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { sendLmsMondayAdminDigest, sendLmsMondayDripLearner } from '../../_lib/lmsEmail.js';

/**
 * Weekly Monday Drip Announcement + Team Progress Digest (Mondays 06:00 UTC = 07:00 WAT).
 * Strictly gated by CRON_SECRET (fail-closed).
 * Also prunes lms_activity_events older than 180 days to protect Supabase Free's 500 MB DB limit.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const now = new Date();
        const weekKey = now.toISOString().slice(0, 10);
        const sevenDaysAgoIso = new Date(now.getTime() - 7 * 86400 * 1000).toISOString();
        const retentionCutoffIso = new Date(now.getTime() - 180 * 86400 * 1000).toISOString();

        // Prune audit logs older than 180 days (protects Supabase Free 500 MB database limit)
        await supabase.from('lms_activity_events').delete().lt('created_at', retentionCutoffIso);

        const [{ data: cohorts }, { data: modules }, { count: totalLessonsCount }] = await Promise.all([
            supabase.from('lms_cohorts').select('*').eq('is_active', true),
            supabase.from('lms_modules').select('id, title, target_week').order('global_order', { ascending: true }),
            supabase.from('lms_lessons').select('id', { count: 'exact', head: true }),
        ]);

        const totalLessons = totalLessonsCount || 1;
        let learnerDigestsSent = 0;
        let adminDigestsSent = 0;

        for (const cohort of cohorts || []) {
            const startMs = new Date(`${cohort.start_date}T00:00:00Z`).getTime();
            const currentWeek = Math.max(1, Math.min(12, Math.floor((now.getTime() - startMs) / (7 * 86400 * 1000)) + 1));
            const weekModules = (modules || []).filter((m: any) => m.target_week === currentWeek).map((m: any) => m.title);

            const [{ data: enrollments }, { data: progressRows }, { count: pendingReviews }] = await Promise.all([
                supabase.from('lms_enrollments').select('*').eq('cohort_id', cohort.id).eq('status', 'active'),
                supabase
                    .from('lms_lesson_progress')
                    .select('user_id, lesson_id, completed_at')
                    .eq('cohort_id', cohort.id)
                    .eq('status', 'completed'),
                supabase
                    .from('lms_project_submissions')
                    .select('id', { count: 'exact', head: true })
                    .eq('cohort_id', cohort.id)
                    .eq('review_status', 'submitted'),
            ]);

            if (!enrollments?.length) continue;

            const doneCountByUser = new Map<string, { total: number; last7d: number }>();
            for (const p of progressRows || []) {
                const cur = doneCountByUser.get(p.user_id) || { total: 0, last7d: 0 };
                cur.total += 1;
                if (p.completed_at && p.completed_at >= sevenDaysAgoIso) cur.last7d += 1;
                doneCountByUser.set(p.user_id, cur);
            }

            const summaryRows: Array<{ fullName: string; progressPct: number; last7d: number; streak: number }> = [];
            for (const enr of enrollments) {
                const stats = doneCountByUser.get(enr.user_id) || { total: 0, last7d: 0 };
                const pct = Math.round((stats.total / totalLessons) * 100);

                summaryRows.push({
                    fullName: enr.full_name,
                    progressPct: pct,
                    last7d: stats.last7d,
                    streak: enr.current_streak || 0,
                });

                const sent = await sendLmsMondayDripLearner({
                    to: enr.email,
                    fullName: enr.full_name,
                    weekNumber: currentWeek,
                    newlyUnlockedModules: weekModules,
                    lessonsCompletedLastWeek: stats.last7d,
                    progressPct: pct,
                    streak: enr.current_streak || 0,
                    cohortId: cohort.id,
                    userId: enr.user_id,
                    weekKey,
                });
                if (sent) learnerDigestsSent += 1;
            }

            const adminEmails = enrollments.filter((e: any) => e.role === 'admin').map((e: any) => e.email);
            if (adminEmails.length > 0) {
                const sent = await sendLmsMondayAdminDigest({
                    to: adminEmails,
                    cohortName: cohort.name,
                    weekNumber: currentWeek,
                    pendingReviewsCount: pendingReviews || 0,
                    learnersSummaryRows: summaryRows,
                    cohortId: cohort.id,
                    weekKey,
                });
                if (sent) adminDigestsSent += 1;
            }
        }

        return res.status(200).json({ ok: true, learnerDigestsSent, adminDigestsSent });
    } catch (err: any) {
        console.error('[cron/lms-weekly-digest] Error:', err);
        return res.status(500).json({ error: err?.message || 'Cron failed' });
    }
}
