import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import {
    buildCohortWeekSchedule,
    getCohortTotalWeeks,
    getCurrentCohortWeek,
    getEffectiveStreak,
    isModuleDripUnlocked,
    requireLmsAdmin,
} from '../../../_lib/lmsGate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const admin = await requireLmsAdmin(req, res);
    if (!admin) return;

    try {
        const cohort = admin.cohort;

        const [
            { data: enrollments },
            { data: modules },
            { data: lessons },
            { data: progress },
            { data: submissions },
            { data: quizAttempts },
            { data: dripOverrides },
        ] = await Promise.all([
            supabase
                .from('lms_enrollments')
                .select('id, user_id, full_name, email, job_role, role, peer_buddy_user_id, current_streak, longest_streak, last_streak_date, last_active_at, created_at, status')
                .eq('cohort_id', cohort.id)
                .eq('status', 'active')
                .order('created_at', { ascending: true }),
            supabase
                .from('lms_modules')
                .select('id, title, global_order, order_index, target_week, course_id, lms_courses(order_index, title)')
                .order('global_order', { ascending: true }),
            supabase.from('lms_lessons').select('id, module_id, lesson_type, duration_seconds, quiz_keys_verified'),
            supabase
                .from('lms_lesson_progress')
                .select('user_id, lesson_id, status, unique_watched_seconds, active_dwell_seconds')
                .eq('cohort_id', cohort.id),
            supabase
                .from('lms_project_submissions')
                .select('id, review_status')
                .eq('cohort_id', cohort.id),
            supabase
                .from('lms_quiz_attempts')
                .select('user_id, score_pct, passed')
                .eq('cohort_id', cohort.id),
            supabase
                .from('lms_overrides')
                .select('user_id, module_id, override_type')
                .eq('cohort_id', cohort.id)
                .eq('override_type', 'unlock_drip'),
        ]);

        const allLessons = lessons || [];
        const allModules = modules || [];
        const moduleWeekById = new Map<string, number>();
        for (const m of allModules) {
            moduleWeekById.set(m.id, m.target_week);
        }

        // Per-user early drip override lookup (supports both week/module-scoped and legacy all-weeks overrides)
        const userDripModIds = new Map<string, Set<string>>();
        const userAllWeeksOverride = new Set<string>();
        for (const ov of dripOverrides || []) {
            if (!ov.user_id) continue;
            if (!ov.module_id) {
                userAllWeeksOverride.add(ov.user_id);
            } else {
                if (!userDripModIds.has(ov.user_id)) userDripModIds.set(ov.user_id, new Set());
                userDripModIds.get(ov.user_id)!.add(ov.module_id);
            }
        }
        const lessonsByMod = new Map<string, string[]>();
        for (const l of allLessons) {
            if (!lessonsByMod.has(l.module_id)) lessonsByMod.set(l.module_id, []);
            lessonsByMod.get(l.module_id)!.push(l.id);
        }

        const now = new Date();
        const eligibleLessonCount = allModules.reduce((acc, m: any) => {
            const drip = isModuleDripUnlocked(cohort, m.target_week, now, false);
            return acc + (drip.unlocked ? (lessonsByMod.get(m.id)?.length || 0) : 0);
        }, 0);
        const targetPct = allLessons.length > 0 ? Math.round((eligibleLessonCount / allLessons.length) * 100) : 0;

        // Per-user progress lookup
        const userProgress = new Map<string, Map<string, any>>();
        for (const p of progress || []) {
            if (!userProgress.has(p.user_id)) userProgress.set(p.user_id, new Map());
            userProgress.get(p.user_id)!.set(p.lesson_id, p);
        }

        const userQuizMap = new Map<string, { attempts: number; passed: number; sumScore: number }>();
        for (const a of quizAttempts || []) {
            const cur = userQuizMap.get(a.user_id) || { attempts: 0, passed: 0, sumScore: 0 };
            cur.attempts += 1;
            if (a.passed) cur.passed += 1;
            cur.sumScore += Number(a.score_pct || 0);
            userQuizMap.set(a.user_id, cur);
        }

        const learnerRows = (enrollments || []).map((enr: any) => {
            const uMap = userProgress.get(enr.user_id) || new Map();
            let completedCount = 0;
            let totalWatchedSec = 0;
            let totalDwellSec = 0;

            for (const row of uMap.values()) {
                if (row.status === 'completed') completedCount += 1;
                totalWatchedSec += row.unique_watched_seconds || 0;
                totalDwellSec += row.active_dwell_seconds || 0;
            }

            const progressPct = allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;
            const lastActiveMs = enr.last_active_at ? new Date(enr.last_active_at).getTime() : new Date(enr.created_at).getTime();
            const daysInactive = Math.max(0, Math.floor((Date.now() - lastActiveMs) / 86400000));

            const modOverrideSet = userDripModIds.get(enr.user_id) || new Set<string>();
            const hasAllWeeksOverride = userAllWeeksOverride.has(enr.user_id);
            const earlyWeeksSet = new Set<number>();
            for (const mid of modOverrideSet) {
                const wk = moduleWeekById.get(mid);
                if (wk) earlyWeeksSet.add(wk);
            }
            const earlyUnlockedWeeks = Array.from(earlyWeeksSet).sort((a, b) => a - b);

            const moduleMatrix = allModules.map((m: any) => {
                const mLessons = lessonsByMod.get(m.id) || [];
                const done = mLessons.filter((lid) => uMap.get(lid)?.status === 'completed').length;
                const started = mLessons.some((lid) => uMap.has(lid));
                const hasModDripOverride = hasAllWeeksOverride || modOverrideSet.has(m.id);
                const drip = isModuleDripUnlocked(cohort, m.target_week, now, hasModDripOverride);
                let cellStatus: 'completed' | 'in_progress' | 'not_started' | 'drip_locked' = 'not_started';
                if (mLessons.length > 0 && done === mLessons.length) cellStatus = 'completed';
                else if (done > 0 || started) cellStatus = 'in_progress';
                else if (!drip.unlocked) cellStatus = 'drip_locked';
                return {
                    moduleId: m.id,
                    globalOrder: m.global_order,
                    targetWeek: m.target_week,
                    status: cellStatus,
                    done,
                    total: mLessons.length,
                };
            });

            const qStats = userQuizMap.get(enr.user_id) || { attempts: 0, passed: 0, sumScore: 0 };
            let riskStatus: 'on_track' | 'behind' | 'at_risk' = 'on_track';
            if (daysInactive >= 5 || progressPct < targetPct - 20) riskStatus = 'at_risk';
            else if (daysInactive >= 3 || progressPct < targetPct - 8) riskStatus = 'behind';

            return {
                enrollmentId: enr.id,
                userId: enr.user_id,
                fullName: enr.full_name,
                email: enr.email,
                jobRole: enr.job_role,
                role: enr.role,
                peerBuddyUserId: enr.peer_buddy_user_id,
                streak: getEffectiveStreak(enr),
                longestStreak: enr.longest_streak || 0,
                lastActiveAt: enr.last_active_at,
                daysInactive,
                completedLessons: completedCount,
                totalLessons: allLessons.length,
                progressPct,
                watchedMinutes: Math.round(totalWatchedSec / 60),
                readingMinutes: Math.round(totalDwellSec / 60),
                avgQuizScore: qStats.attempts > 0 ? Math.round(qStats.sumScore / qStats.attempts) : null,
                riskStatus,
                earlyUnlockedWeeks,
                hasAllWeeksOverride,
                moduleMatrix,
            };
        });

        const pendingReviewsCount = (submissions || []).filter((s: any) => s.review_status === 'submitted').length;
        const unverifiedQuizzesCount = allLessons.filter((l: any) => l.lesson_type === 'quiz' && !l.quiz_keys_verified).length;
        const totalQuizzesCount = allLessons.filter((l: any) => l.lesson_type === 'quiz').length;

        return res.status(200).json({
            cohort,
            currentCalendarWeek: getCurrentCohortWeek(cohort, now),
            totalWeeks: getCohortTotalWeeks(cohort),
            weekSchedule: buildCohortWeekSchedule(cohort),
            summary: {
                totalLearners: learnerRows.length,
                atRiskCount: learnerRows.filter((r) => r.riskStatus === 'at_risk').length,
                avgProgressPct:
                    learnerRows.length > 0
                        ? Math.round(learnerRows.reduce((a, r) => a + r.progressPct, 0) / learnerRows.length)
                        : 0,
                targetPct,
                pendingReviewsCount,
                unverifiedQuizzesCount,
                totalQuizzesCount,
            },
            modules: allModules.map((m: any) => ({
                id: m.id,
                title: m.title,
                globalOrder: m.global_order,
                targetWeek: m.target_week,
                courseOrder: m.lms_courses?.order_index ?? 0,
            })),
            learners: learnerRows,
        });
    } catch (err: any) {
        console.error('[admin/lms/overview] Error:', err);
        return res.status(500).json({ error: err?.message || 'Failed to load overview' });
    }
}
