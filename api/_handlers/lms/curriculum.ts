import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import {
    buildCohortWeekSchedule,
    getCohortTotalWeeks,
    getCurrentCohortWeek,
    getEffectiveStreak,
    isModuleDripUnlocked,
    normalizeWeeklyLeads,
    requireLmsMember,
} from '../../_lib/lmsGate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const member = await requireLmsMember(req, res);
    if (!member) return;

    try {
        const { cohort, enrollment } = member;

        const [
            { data: courses },
            { data: modules },
            { data: lessons },
            { data: progressRows },
            { data: submissions },
            { data: overrides },
            { data: recentTakeaways },
            { data: cohortMembers },
            { data: cohortCompletedRows },
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
            // Active cohort roster (safe non-PII fields only: name, role, study pod, streak)
            supabase
                .from('lms_enrollments')
                .select('user_id, full_name, job_role, role, study_group_name, peer_buddy_user_id, current_streak, longest_streak, last_streak_date, last_active_at')
                .eq('cohort_id', cohort.id)
                .eq('status', 'active')
                .order('full_name', { ascending: true }),
            // Compact completed-lesson user_id list for cohort pod progress counts
            supabase
                .from('lms_lesson_progress')
                .select('user_id')
                .eq('cohort_id', cohort.id)
                .eq('status', 'completed'),
        ]);

        const progressMap = new Map<string, any>();
        for (const p of progressRows || []) progressMap.set(p.lesson_id, p);

        const submissionMap = new Map<string, any>();
        for (const s of submissions || []) submissionMap.set(s.lesson_id, s);

        const now = new Date();
        const isAdmin = enrollment.role === 'admin';

        // Build Module-Gated, Flexible Within-Module access state:
        //  - Between modules/weeks: strict global dual-lock (all earlier modules done + Monday drip unlocked)
        //  - Inside unlocked module: Video + Readings unlock together; Quizzes after Video+Readings; Project after Quizzes
        const allLessons = lessons || [];
        const completedSet = new Set<string>(
            (progressRows || []).filter((p: any) => p.status === 'completed').map((p: any) => p.lesson_id),
        );

        const moduleMap = new Map<string, any>();
        for (const m of modules || []) moduleMap.set(m.id, m);

        const rawLessonsByMod = new Map<string, any[]>();
        for (const l of allLessons) {
            const list = rawLessonsByMod.get(l.module_id) || [];
            list.push(l);
            rawLessonsByMod.set(l.module_id, list);
        }

        const prevModulesDoneByModId = new Map<string, boolean>();
        const studyDoneByModId = new Map<string, boolean>();
        const studyAndQuizDoneByModId = new Map<string, boolean>();

        let allPriorModulesDone = true;
        for (const m of modules || []) {
            prevModulesDoneByModId.set(m.id, allPriorModulesDone);
            const mList = rawLessonsByMod.get(m.id) || [];
            const studyItems = mList.filter((l: any) => l.lesson_type === 'video' || l.lesson_type === 'reading');
            const studyAndQuizItems = mList.filter(
                (l: any) => l.lesson_type === 'video' || l.lesson_type === 'reading' || l.lesson_type === 'quiz',
            );
            const studyDone = studyItems.every((l: any) => completedSet.has(l.id));
            const studyQuizDone = studyAndQuizItems.every((l: any) => completedSet.has(l.id));
            const modAllDone = mList.every((l: any) => completedSet.has(l.id));
            studyDoneByModId.set(m.id, studyDone);
            studyAndQuizDoneByModId.set(m.id, studyQuizDone);
            if (!modAllDone) allPriorModulesDone = false;
        }

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
            const priorModulesDone = prevModulesDoneByModId.get(lesson.module_id) ?? true;
            const studyDone = studyDoneByModId.get(lesson.module_id) ?? true;
            const studyQuizDone = studyAndQuizDoneByModId.get(lesson.module_id) ?? true;

            let prereqMet = false;
            if (priorModulesDone) {
                if (lesson.lesson_type === 'video' || lesson.lesson_type === 'reading') {
                    prereqMet = true;
                } else if (lesson.lesson_type === 'quiz') {
                    prereqMet = studyDone;
                } else {
                    prereqMet = studyQuizDone;
                }
            }

            const isDone = completedSet.has(lesson.id);
            const prog = progressMap.get(lesson.id);

            let state = 'locked_prereq';
            if (isDone) {
                state = 'completed';
            } else if (!drip.unlocked) {
                state = 'locked_drip';
            } else if (prereqMet || hasLessonOverride || isAdmin) {
                state = prog ? 'in_progress' : 'unlocked';
                if (!nextUpLesson) {
                    nextUpLesson = {
                        id: lesson.id,
                        slug: lesson.slug,
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

        // Current curriculum week (1..12) + total calendar weeks (12 + extensions)
        const currentWeek = getCurrentCohortWeek(cohort, now);
        const totalWeeks = getCohortTotalWeeks(cohort);
        const weekSchedule = buildCohortWeekSchedule(cohort);
        const liveStreak = getEffectiveStreak(enrollment);

        // Aggregate completed lesson counts across cohort members (in-memory, 0 extra DB queries)
        const completedCountByUser = new Map<string, number>();
        for (const r of cohortCompletedRows || []) {
            completedCountByUser.set(r.user_id, (completedCountByUser.get(r.user_id) || 0) + 1);
        }

        const weeklyLeadsMap = normalizeWeeklyLeads(cohort.weekly_leads_json);
        const currentWeekLeadUserId = weeklyLeadsMap[String(currentWeek)] || null;

        const roster = (cohortMembers || []).map((m: any) => {
            const done = completedCountByUser.get(m.user_id) || 0;
            return {
                userId: m.user_id,
                fullName: m.full_name,
                jobRole: m.job_role || null,
                role: m.role,
                studyGroup: m.study_group_name || null,
                peerBuddyUserId: m.peer_buddy_user_id || null,
                completedLessons: done,
                totalLessons,
                progressPct: totalLessons > 0 ? Math.round((done / totalLessons) * 100) : 0,
                streak: getEffectiveStreak(m),
                lastActiveAt: m.last_active_at || null,
                isCurrentUser: m.user_id === enrollment.user_id,
                isWeeklyLead: Boolean(currentWeekLeadUserId && m.user_id === currentWeekLeadUserId),
            };
        });

        // Build Study Groups / Pods (supports 2, 3, 4+ members per pod + backward-compatible legacy 1-to-1 pairs)
        const groupsMap = new Map<string, typeof roster>();
        const unassigned: typeof roster = [];
        const handledLegacyPairs = new Set<string>();

        for (const m of roster) {
            if (m.studyGroup) {
                const list = groupsMap.get(m.studyGroup) || [];
                list.push(m);
                groupsMap.set(m.studyGroup, list);
            }
        }

        // Fold any legacy 1-to-1 peer_buddy_user_id pairs (without study_group_name) into auto-named pairs
        let legacyPairNum = 1;
        for (const m of roster) {
            if (m.studyGroup || handledLegacyPairs.has(m.userId)) continue;
            if (m.peerBuddyUserId) {
                const buddy = roster.find((x) => x.userId === m.peerBuddyUserId && !x.studyGroup);
                if (buddy && !handledLegacyPairs.has(buddy.userId)) {
                    const pairLabel = `Pair ${legacyPairNum++}`;
                    groupsMap.set(pairLabel, [m, buddy]);
                    handledLegacyPairs.add(m.userId);
                    handledLegacyPairs.add(buddy.userId);
                    continue;
                }
            }
            unassigned.push(m);
        }

        const groups = Array.from(groupsMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, membersList]) => ({
                name,
                members: membersList.map(({ peerBuddyUserId: _p, userId: _u, ...safe }) => safe),
            }));

        const myGroupEntry = Array.from(groupsMap.entries()).find(([, membersList]) =>
            membersList.some((x) => x.isCurrentUser),
        );
        const myStudyGroup = myGroupEntry
            ? {
                  name: myGroupEntry[0],
                  members: myGroupEntry[1].map(({ peerBuddyUserId: _p, userId: _u, ...safe }) => safe),
              }
            : null;

        const leadMember = currentWeekLeadUserId ? roster.find((m) => m.userId === currentWeekLeadUserId) : null;
        const weeklyLead = leadMember
            ? {
                  week: currentWeek,
                  fullName: leadMember.fullName,
                  jobRole: leadMember.jobRole,
                  studyGroup: leadMember.studyGroup,
                  progressPct: leadMember.progressPct,
                  streak: leadMember.streak,
                  isCurrentUser: leadMember.isCurrentUser,
              }
            : null;

        return res.status(200).json({
            cohort,
            enrollment: {
                ...enrollment,
                current_streak: liveStreak,
            },
            stats: {
                currentWeek,
                totalWeeks,
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
            weeklyLead,
            myStudyGroup,
            teamPairings: {
                groups,
                unassigned: unassigned.map(({ peerBuddyUserId: _p, userId: _u, ...safe }) => safe),
            },
            weekSchedule,
            nextUpLesson,
            courses: tree,
            teamFeed,
        });
    } catch (err: any) {
        console.error('[lms/curriculum] Error:', err);
        return res.status(500).json({ error: err?.message || 'Failed to load curriculum' });
    }
}
