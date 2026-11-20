import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { getEffectiveStreak, isModuleDripUnlocked, requireLmsMember } from '../../_lib/lmsGate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const member = await requireLmsMember(req, res);
    if (!member) return;

    try {
        const { cohort, enrollment } = member;

        const partnerUserId = enrollment.peer_buddy_user_id || null;

        const [
            { data: courses },
            { data: modules },
            { data: lessons },
            { data: progressRows },
            { data: submissions },
            { data: overrides },
            { data: recentTakeaways },
            partnerEnrollmentRes,
            partnerCompletedCountRes,
            partnerLatestProgressRes,
        ] = await Promise.all([
            supabase.from('lms_courses').select('*').order('order_index', { ascending: true }),
            supabase.from('lms_modules').select('*').order('global_order', { ascending: true }),
            supabase
                .from('lms_lessons')
                .select('id, module_id, slug, order_index, global_order, lesson_type, title, estimated_minutes, duration_seconds, word_count, quiz_keys_verified')
                .order('global_order', { ascending: true }),
            supabase
                .from('lms_lesson_progress')
                .select('lesson_id, status, unique_watched_seconds, scroll_depth_pct, active_dwell_seconds, completed_at')
                .eq('cohort_id', cohort.id)
                .eq('user_id', enrollment.user_id),
            supabase
                .from('lms_project_submissions')
                .select('lesson_id, review_status, submitted_at, reviewed_at')
                .eq('cohort_id', cohort.id)
                .eq('user_id', enrollment.user_id),
            supabase
                .from('lms_overrides')
                .select('*')
                .eq('cohort_id', cohort.id)
                .or(`user_id.is.null,user_id.eq.${enrollment.user_id}`),
            supabase
                .from('lms_lesson_progress')
                .select('key_takeaway, completed_at, user_id, lms_lessons(title)')
                .eq('cohort_id', cohort.id)
                .not('key_takeaway', 'is', null)
                .order('completed_at', { ascending: false })
                .limit(12),
            // Ultra-lightweight Study Partner queries (only run when paired; 0 rows transferred for count!)
            partnerUserId
                ? supabase
                      .from('lms_enrollments')
                      .select('user_id, full_name, job_role, current_streak, longest_streak, last_streak_date, last_active_at')
                      .eq('cohort_id', cohort.id)
                      .eq('user_id', partnerUserId)
                      .eq('status', 'active')
                      .maybeSingle()
                : Promise.resolve({ data: null }),
            partnerUserId
                ? supabase
                      .from('lms_lesson_progress')
                      .select('lesson_id', { count: 'exact', head: true })
                      .eq('cohort_id', cohort.id)
                      .eq('user_id', partnerUserId)
                      .eq('status', 'completed')
                : Promise.resolve({ count: 0 }),
            partnerUserId
                ? supabase
                      .from('lms_lesson_progress')
                      .select('lesson_id, completed_at')
                      .eq('cohort_id', cohort.id)
                      .eq('user_id', partnerUserId)
                      .eq('status', 'completed')
                      .order('completed_at', { ascending: false })
                      .limit(1)
                      .maybeSingle()
                : Promise.resolve({ data: null }),
        ]);

        const progressMap = new Map<string, any>();
        for (const p of progressRows || []) progressMap.set(p.lesson_id, p);

        const submissionMap = new Map<string, any>();
        for (const s of submissions || []) submissionMap.set(s.lesson_id, s);

        const now = new Date();
        const isAdmin = enrollment.role === 'admin';

        // Build global sequential state across all lessons
        const allLessons = lessons || [];
        const completedSet = new Set<string>(
            (progressRows || []).filter((p: any) => p.status === 'completed').map((p: any) => p.lesson_id),
        );

        const moduleMap = new Map<string, any>();
        for (const m of modules || []) moduleMap.set(m.id, m);

        let nextUpLesson: any = null;
        const lessonStateMap = new Map<string, { state: string; unlocksAt?: string }>();

        for (let i = 0; i < allLessons.length; i++) {
            const lesson = allLessons[i];
            const mod = moduleMap.get(lesson.module_id);
            const hasDripOverride = (overrides || []).some(
                (o: any) => o.override_type === 'unlock_drip' && (!o.module_id || o.module_id === mod?.id),
            );
            const hasLessonOverride = (overrides || []).some(
                (o: any) => o.override_type === 'unlock_lesson' && (o.lesson_id === lesson.id || o.module_id === mod?.id),
            );

            const drip = isModuleDripUnlocked(cohort, mod?.target_week || 1, now, hasDripOverride || isAdmin);
            const prevCompleted = i === 0 || completedSet.has(allLessons[i - 1].id);
            const isDone = completedSet.has(lesson.id);
            const prog = progressMap.get(lesson.id);

            let state = 'locked_prereq';
            if (isDone) {
                state = 'completed';
            } else if (!drip.unlocked) {
                state = 'locked_drip';
            } else if (prevCompleted || hasLessonOverride || isAdmin) {
                state = prog ? 'in_progress' : 'unlocked';
                if (!nextUpLesson) {
                    nextUpLesson = {
                        id: lesson.id,
                        title: lesson.title,
                        lesson_type: lesson.lesson_type,
                        estimated_minutes: lesson.estimated_minutes,
                        module_title: mod?.title || '',
                        target_week: mod?.target_week || 1,
                    };
                }
            }

            lessonStateMap.set(lesson.id, { state, unlocksAt: drip.unlocksAt });
        }

        // Group lessons -> modules -> courses
        const lessonsByModule = new Map<string, any[]>();
        for (const l of allLessons) {
            const st = lessonStateMap.get(l.id)!;
            const prog = progressMap.get(l.id);
            const sub = submissionMap.get(l.id);
            if (!lessonsByModule.has(l.module_id)) lessonsByModule.set(l.module_id, []);
            lessonsByModule.get(l.module_id)!.push({
                ...l,
                access_state: st.state,
                unlocks_at: st.unlocksAt,
                unique_watched_seconds: prog?.unique_watched_seconds || 0,
                completed_at: prog?.completed_at || null,
                project_review_status: sub?.review_status || null,
            });
        }

        const modulesByCourse = new Map<string, any[]>();
        let completedModulesCount = 0;
        let eligibleLessonsCount = 0;

        for (const m of modules || []) {
            const mLessons = lessonsByModule.get(m.id) || [];
            const mCompleted = mLessons.filter((l) => l.access_state === 'completed').length;
            const hasDripOverride = (overrides || []).some(
                (o: any) => o.override_type === 'unlock_drip' && (!o.module_id || o.module_id === m.id),
            );
            const dripForAccess = isModuleDripUnlocked(cohort, m.target_week, now, hasDripOverride || isAdmin);
            // Always calculate cohort target % using the real calendar schedule (not admin preview bypass!)
            const dripForTarget = isModuleDripUnlocked(cohort, m.target_week, now, false);
            if (dripForTarget.unlocked) eligibleLessonsCount += mLessons.length;
            if (mLessons.length > 0 && mCompleted === mLessons.length) completedModulesCount += 1;

            if (!modulesByCourse.has(m.course_id)) modulesByCourse.set(m.course_id, []);
            modulesByCourse.get(m.course_id)!.push({
                ...m,
                drip_unlocked: dripForAccess.unlocked,
                drip_unlocks_at: dripForAccess.unlocksAt,
                total_lessons: mLessons.length,
                completed_lessons: mCompleted,
                lessons: mLessons,
            });
        }

        const tree = (courses || []).map((c: any) => {
            const cMods = modulesByCourse.get(c.id) || [];
            const totalL = cMods.reduce((acc, m) => acc + m.total_lessons, 0);
            const compL = cMods.reduce((acc, m) => acc + m.completed_lessons, 0);
            return {
                ...c,
                total_lessons: totalL,
                completed_lessons: compL,
                modules: cMods,
            };
        });

        // Resolve names for team takeaway feed
        const takeawayUserIds = [...new Set((recentTakeaways || []).map((t: any) => t.user_id))];
        const nameMap = new Map<string, string>();
        if (takeawayUserIds.length > 0) {
            const { data: members } = await supabase
                .from('lms_enrollments')
                .select('user_id, full_name')
                .eq('cohort_id', cohort.id)
                .in('user_id', takeawayUserIds);
            for (const m of members || []) nameMap.set(m.user_id, m.full_name);
        }

        const teamFeed = (recentTakeaways || []).map((t: any) => ({
            learnerName: nameMap.get(t.user_id) || 'Teammate',
            lessonTitle: t.lms_lessons?.title || 'Lesson',
            takeaway: t.key_takeaway,
            completedAt: t.completed_at,
        }));

        const totalLessons = allLessons.length;
        const completedLessons = completedSet.size;
        const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        const targetPct = totalLessons > 0 ? Math.round((eligibleLessonsCount / totalLessons) * 100) : 0;

        // Current cohort week (1..12)
        const startMs = new Date(`${cohort.start_date}T00:00:00Z`).getTime();
        const currentWeek = Math.max(1, Math.min(12, Math.floor((Date.now() - startMs) / (7 * 86400 * 1000)) + 1));

        const liveStreak = getEffectiveStreak(enrollment);

        // Assemble compact Study Partner summary from in-memory lesson/module maps (0 extra queries)
        let studyPartner: {
            fullName: string;
            jobRole: string | null;
            completedLessons: number;
            totalLessons: number;
            progressPct: number;
            currentWeek: number;
            streak: number;
            longestStreak: number;
            lastActiveAt: string | null;
        } | null = null;

        const partnerRow = partnerEnrollmentRes?.data as any;
        if (partnerRow) {
            const pCompleted = (partnerCompletedCountRes as any)?.count || 0;
            const latestRow = (partnerLatestProgressRes as any)?.data as { lesson_id?: string } | null;
            let partnerWeek = 1;
            if (latestRow?.lesson_id) {
                const matchedLesson = allLessons.find((l: any) => l.id === latestRow.lesson_id);
                if (matchedLesson) {
                    const matchedMod = moduleMap.get(matchedLesson.module_id);
                    if (matchedMod?.target_week) partnerWeek = matchedMod.target_week;
                }
            }
            studyPartner = {
                fullName: partnerRow.full_name,
                jobRole: partnerRow.job_role || null,
                completedLessons: pCompleted,
                totalLessons,
                progressPct: totalLessons > 0 ? Math.round((pCompleted / totalLessons) * 100) : 0,
                currentWeek: partnerWeek,
                streak: getEffectiveStreak(partnerRow),
                longestStreak: partnerRow.longest_streak || 0,
                lastActiveAt: partnerRow.last_active_at || null,
            };
        }

        return res.status(200).json({
            cohort,
            enrollment: {
                ...enrollment,
                current_streak: liveStreak,
            },
            stats: {
                currentWeek,
                totalCourses: (courses || []).length,
                totalModules: (modules || []).length,
                completedModules: completedModulesCount,
                totalLessons,
                completedLessons,
                eligibleLessons: eligibleLessonsCount,
                progressPct,
                targetPct,
                streak: liveStreak,
                longestStreak: enrollment.longest_streak || 0,
            },
            studyPartner,
            nextUpLesson,
            courses: tree,
            teamFeed,
        });
    } catch (err: any) {
        console.error('[lms/curriculum] Error:', err);
        return res.status(500).json({ error: err?.message || 'Failed to load curriculum' });
    }
}
