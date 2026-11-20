import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import {
    evaluateLessonAccess,
    logLmsEvent,
    QuizQuestion,
    requireLmsMember,
    touchLearnerStreak,
} from '../../_lib/lmsGate.js';
import { checkAndNotifyModuleCompletion } from './progress-complete.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const member = await requireLmsMember(req, res);
    if (!member) return;

    const { lessonId, answers } = req.body || {};
    if (!lessonId || !answers || typeof answers !== 'object') {
        return res.status(400).json({ error: 'lessonId and answers object are required.' });
    }

    const access = await evaluateLessonAccess({
        cohort: member.cohort,
        enrollment: member.enrollment,
        lessonId: String(lessonId),
        includeContent: true,
    });
    if (!access.allowed) {
        return res.status(403).json({ error: 'Lesson locked', reason: access.reason });
    }

    const lesson = access.lesson;
    if (lesson.lesson_type !== 'quiz') {
        return res.status(400).json({ error: 'This lesson is not a quiz.' });
    }

    const questions: QuizQuestion[] = Array.isArray(lesson.quiz_questions_json) ? lesson.quiz_questions_json : [];
    if (questions.length === 0) {
        return res.status(400).json({ error: 'Quiz has no questions configured.' });
    }

    // Verify all questions were answered and build a strictly sanitized answers map
    const sanitizedAnswers: Record<string, number[]> = {};
    for (const q of questions) {
        const picked = answers[q.id];
        if (!Array.isArray(picked) || picked.length === 0) {
            return res.status(400).json({ error: `Please answer every question before submitting (${q.id} is unanswered).` });
        }
        const maxIdx = Math.max(0, (q.options || []).length - 1);
        const validPicked = [...new Set(picked.map(Number))]
            .filter((n) => Number.isInteger(n) && n >= 0 && n <= maxIdx)
            .sort((a, b) => a - b);
        if (validPicked.length === 0) {
            return res.status(400).json({ error: `Invalid option selection for question ${q.id}.` });
        }
        sanitizedAnswers[q.id] = q.type === 'single' ? [validPicked[0]] : validPicked;
    }

    const keysReady = Boolean(lesson.quiz_keys_verified) && questions.every((q) => Array.isArray(q.correct_indices) && q.correct_indices.length > 0);
    const threshold = lesson.pass_threshold_pct || 80;

    let correctCount = 0;
    const breakdown = questions.map((q) => {
        const picked = sanitizedAnswers[q.id];
        if (!keysReady) {
            correctCount += 1;
            return {
                id: q.id,
                picked,
                correct: true,
                explanation: 'Recorded! Answer key is pending admin verification, so full credit was awarded for completing all questions.',
            };
        }
        const expected = [...new Set((q.correct_indices || []).map(Number))].sort((a, b) => a - b);
        const isCorrect = picked.length === expected.length && picked.every((v, idx) => v === expected[idx]);
        if (isCorrect) correctCount += 1;
        return {
            id: q.id,
            picked,
            correct: isCorrect,
            explanation: q.explanation || '',
        };
    });

    const scorePct = Math.round((correctCount / questions.length) * 100);
    const passed = !keysReady || scorePct >= threshold;

    const { count: prevAttempts } = await supabase
        .from('lms_quiz_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('cohort_id', member.cohort.id)
        .eq('user_id', member.enrollment.user_id)
        .eq('lesson_id', lesson.id);

    const attemptNumber = (prevAttempts || 0) + 1;

    await supabase.from('lms_quiz_attempts').insert({
        cohort_id: member.cohort.id,
        user_id: member.enrollment.user_id,
        lesson_id: lesson.id,
        attempt_number: attemptNumber,
        answers_json: sanitizedAnswers,
        score_pct: scorePct,
        passed,
    });

    await logLmsEvent({
        cohortId: member.cohort.id,
        userId: member.enrollment.user_id,
        lessonId: lesson.id,
        eventType: passed ? 'quiz_passed' : 'quiz_failed',
        metadata: { scorePct, attemptNumber, keysReady },
    });

    let nextLesson: any = null;
    if (passed) {
        const nowIso = new Date().toISOString();
        await supabase.from('lms_lesson_progress').upsert(
            {
                cohort_id: member.cohort.id,
                user_id: member.enrollment.user_id,
                lesson_id: lesson.id,
                status: 'completed',
                completed_at: nowIso,
                updated_at: nowIso,
            },
            { onConflict: 'cohort_id,user_id,lesson_id' },
        );

        const { currentStreak } = await touchLearnerStreak(member.enrollment);
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

        const { data: nl } = await supabase
            .from('lms_lessons')
            .select('id, title, lesson_type')
            .eq('global_order', lesson.global_order + 1)
            .maybeSingle();
        nextLesson = nl || null;
    }

    return res.status(200).json({
        passed,
        scorePct,
        correctCount,
        totalQuestions: questions.length,
        passThresholdPct: threshold,
        keysVerified: keysReady,
        attemptNumber,
        breakdown,
        nextLesson,
    });
}
