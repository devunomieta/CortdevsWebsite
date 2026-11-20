import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import {
    evaluateLessonAccess,
    logLmsEvent,
    requireLmsMember,
    sanitizePlainText,
    touchLearnerStreak,
} from '../../_lib/lmsGate.js';
import { sendLmsModuleCompleted } from '../../_lib/lmsEmail.js';

export async function checkAndNotifyModuleCompletion(params: {
    cohortId: string;
    userId: string;
    email: string;
    fullName: string;
    moduleId: string;
    moduleTitle: string;
    currentGlobalOrder: number;
    streak: number;
}) {
    const { data: modLessons } = await supabase
        .from('lms_lessons')
        .select('id')
        .eq('module_id', params.moduleId);

    if (!modLessons?.length) return;

    const { data: doneRows } = await supabase
        .from('lms_lesson_progress')
        .select('lesson_id')
        .eq('cohort_id', params.cohortId)
        .eq('user_id', params.userId)
        .eq('status', 'completed')
        .in('lesson_id', modLessons.map((l: any) => l.id));

    if ((doneRows?.length || 0) < modLessons.length) return;

    // All lessons in this module are complete!
    const [{ count: totalModules }, { data: allModules }, { data: allDone }, { data: nextLesson }] = await Promise.all([
        supabase.from('lms_modules').select('id', { count: 'exact', head: true }),
        supabase.from('lms_modules').select('id, lms_lessons(id)'),
        supabase
            .from('lms_lesson_progress')
            .select('lesson_id')
            .eq('cohort_id', params.cohortId)
            .eq('user_id', params.userId)
            .eq('status', 'completed'),
        supabase
            .from('lms_lessons')
            .select('id, title, lms_modules(title)')
            .eq('global_order', params.currentGlobalOrder + 1)
            .maybeSingle(),
    ]);

    const doneSet = new Set((allDone || []).map((r: any) => r.lesson_id));
    let completedModulesCount = 0;
    for (const m of allModules || []) {
        const ls = (m as any).lms_lessons || [];
        if (ls.length > 0 && ls.every((l: any) => doneSet.has(l.id))) {
            completedModulesCount += 1;
        }
    }

    await logLmsEvent({
        cohortId: params.cohortId,
        userId: params.userId,
        eventType: 'module_completed',
        metadata: { moduleId: params.moduleId, moduleTitle: params.moduleTitle },
    });

    await sendLmsModuleCompleted({
        to: params.email,
        fullName: params.fullName,
        completedModuleTitle: params.moduleTitle,
        nextModuleTitle: (nextLesson as any)?.lms_modules?.title,
        nextLessonId: nextLesson?.id,
        completedModulesCount,
        totalModulesCount: totalModules || 28,
        streak: params.streak,
        cohortId: params.cohortId,
        userId: params.userId,
        moduleId: params.moduleId,
    }).catch((e) => console.error('[lms/complete] Module email failed:', e));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const member = await requireLmsMember(req, res);
    if (!member) return;

    const { lessonId, keyTakeaway } = req.body || {};
    if (!lessonId) return res.status(400).json({ error: 'lessonId required' });

    const access = await evaluateLessonAccess({
        cohort: member.cohort,
        enrollment: member.enrollment,
        lessonId: String(lessonId),
    });
    if (!access.allowed) {
        return res.status(403).json({ error: 'Lesson locked', reason: access.reason });
    }

    const lesson = access.lesson;
    if (lesson.lesson_type === 'quiz' || lesson.lesson_type === 'project') {
        return res.status(400).json({
            error: `Use the ${lesson.lesson_type} submission endpoint to complete this lesson.`,
        });
    }

    const { data: prog } = await supabase
        .from('lms_lesson_progress')
        .select('*')
        .eq('cohort_id', member.cohort.id)
        .eq('user_id', member.enrollment.user_id)
        .eq('lesson_id', lesson.id)
        .maybeSingle();

    const isAdmin = member.enrollment.role === 'admin';

    if (lesson.lesson_type === 'video' && !isAdmin) {
        const dur = lesson.duration_seconds || 0;
        const watched = prog?.unique_watched_seconds || 0;
        const pct = dur > 0 ? Math.round((watched / dur) * 100) : 100;
        if (pct < 90) {
            return res.status(400).json({
                error: `Watch at least 90% of the video to complete this lesson (currently ${pct}% unique watched).`,
                watchPct: pct,
            });
        }
    }

    const cleanTakeaway = sanitizePlainText(keyTakeaway, 500);

    if (lesson.lesson_type === 'reading' && !isAdmin) {
        const scrollPct = prog?.scroll_depth_pct || 0;
        const dwell = prog?.active_dwell_seconds || 0;
        const minDwell = lesson.min_dwell_seconds || 30;
        if (scrollPct < 85) {
            return res.status(400).json({ error: `Please scroll through the full reading before completing (${scrollPct}% read).` });
        }
        if (dwell < minDwell) {
            return res.status(400).json({
                error: `Please spend at least ${minDwell}s actively reading before marking complete (${dwell}s logged so far).`,
            });
        }
        if (cleanTakeaway.length < 30) {
            return res.status(400).json({
                error: 'Enter a brief 1-sentence Key Takeaway (at least 30 characters) to lock in what you learned.',
            });
        }
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error } = await supabase
        .from('lms_lesson_progress')
        .upsert(
            {
                cohort_id: member.cohort.id,
                user_id: member.enrollment.user_id,
                lesson_id: lesson.id,
                status: 'completed',
                watched_ranges_json: prog?.watched_ranges_json || [],
                unique_watched_seconds: prog?.unique_watched_seconds || 0,
                max_watched_second: prog?.max_watched_second || 0,
                last_position_seconds: prog?.last_position_seconds || 0,
                scroll_depth_pct: Math.max(prog?.scroll_depth_pct || 0, 100),
                active_dwell_seconds: prog?.active_dwell_seconds || 0,
                key_takeaway: cleanTakeaway || prog?.key_takeaway || null,
                completed_at: prog?.completed_at || nowIso,
                updated_at: nowIso,
            },
            { onConflict: 'cohort_id,user_id,lesson_id' },
        )
        .select('*')
        .single();

    if (error) return res.status(500).json({ error: error.message });

    const { currentStreak } = await touchLearnerStreak(member.enrollment);

    await logLmsEvent({
        cohortId: member.cohort.id,
        userId: member.enrollment.user_id,
        lessonId: lesson.id,
        eventType: lesson.lesson_type === 'video' ? 'video_completed' : 'reading_completed',
        metadata: { title: lesson.title, hasTakeaway: Boolean(cleanTakeaway) },
    });

    await checkAndNotifyModuleCompletion({
        cohortId: member.cohort.id,
        userId: member.enrollment.user_id,
        email: member.enrollment.email,
        fullName: member.enrollment.full_name,
        moduleId: lesson.module_id,
        moduleTitle: access.module?.title || 'Module',
        currentGlobalOrder: lesson.global_order,
        streak: currentStreak,
    });

    const { data: nextLesson } = await supabase
        .from('lms_lessons')
        .select('id, title, lesson_type')
        .eq('global_order', lesson.global_order + 1)
        .maybeSingle();

    return res.status(200).json({
        ok: true,
        progress: updated,
        streak: currentStreak,
        nextLesson: nextLesson || null,
    });
}
