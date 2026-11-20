import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { evaluateLessonAccess, requireLmsMember, sanitizeQuizForClient } from '../../_lib/lmsGate.js';
import { isR2Configured, signLessonVideoUrl } from '../../_lib/lmsR2.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const member = await requireLmsMember(req, res);
    if (!member) return;

    const lessonId = String(req.query?.id || '').trim();
    if (!lessonId) {
        return res.status(400).json({ error: 'Missing lesson id' });
    }

    try {
        const access = await evaluateLessonAccess({
            cohort: member.cohort,
            enrollment: member.enrollment,
            lessonId,
            includeContent: true,
        });

        if (!access.allowed) {
            if (access.reason === 'not_found') {
                return res.status(404).json({ error: 'Lesson not found' });
            }
            return res.status(403).json({
                error:
                    access.reason === 'drip_locked'
                        ? 'This module is locked until its Weekly Monday Drip date.'
                        : 'Complete the previous lesson first to unlock this lesson.',
                reason: access.reason,
                unlocksAt: access.unlocksAt,
                prerequisiteLessonId: access.prerequisiteLessonId,
                prerequisiteTitle: access.prerequisiteTitle,
            });
        }

        const lesson = access.lesson;
        const mod = access.module;

        // Fetch user progress + next/prev lesson pointers + attempts/submission
        const [
            { data: progress },
            { data: prevLesson },
            { data: nextLesson },
            { data: attempts },
            { data: submission },
        ] = await Promise.all([
            supabase
                .from('lms_lesson_progress')
                .select('*')
                .eq('cohort_id', member.cohort.id)
                .eq('user_id', member.enrollment.user_id)
                .eq('lesson_id', lesson.id)
                .maybeSingle(),
            supabase
                .from('lms_lessons')
                .select('id, title, lesson_type')
                .eq('global_order', lesson.global_order - 1)
                .maybeSingle(),
            supabase
                .from('lms_lessons')
                .select('id, title, lesson_type')
                .eq('global_order', lesson.global_order + 1)
                .maybeSingle(),
            lesson.lesson_type === 'quiz'
                ? supabase
                      .from('lms_quiz_attempts')
                      .select('id, attempt_number, score_pct, passed, submitted_at')
                      .eq('cohort_id', member.cohort.id)
                      .eq('user_id', member.enrollment.user_id)
                      .eq('lesson_id', lesson.id)
                      .order('attempt_number', { ascending: false })
                      .limit(10)
                : Promise.resolve({ data: [] }),
            lesson.lesson_type === 'project'
                ? supabase
                      .from('lms_project_submissions')
                      .select('*')
                      .eq('cohort_id', member.cohort.id)
                      .eq('user_id', member.enrollment.user_id)
                      .eq('lesson_id', lesson.id)
                      .maybeSingle()
                : Promise.resolve({ data: null }),
        ]);

        // Ensure an 'in_progress' record exists once opened
        if (!progress) {
            await supabase.from('lms_lesson_progress').insert({
                cohort_id: member.cohort.id,
                user_id: member.enrollment.user_id,
                lesson_id: lesson.id,
                status: 'in_progress',
            });
        }

        // Build content payload specific to lesson type
        let videoSignedUrl: string | null = null;
        const r2Ready = isR2Configured();
        if (lesson.lesson_type === 'video' && lesson.video_r2_key && r2Ready) {
            videoSignedUrl = await signLessonVideoUrl(lesson.video_r2_key, 900);
        }

        let projectAssetsWithUrls: any[] = [];
        const canViewExemplar = Boolean(submission) || member.enrollment.role === 'admin';
        if (lesson.lesson_type === 'project' && Array.isArray(lesson.project_assets_json)) {
            projectAssetsWithUrls = await Promise.all(
                lesson.project_assets_json.map(async (asset: any) => {
                    const isExemplar = Boolean(asset.is_exemplar || /exemplar/i.test(asset.name || ''));
                    if (isExemplar && !canViewExemplar) {
                        return {
                            name: asset.name,
                            type: asset.type,
                            isExemplar: true,
                            lockedUntilSubmit: true,
                            downloadUrl: null,
                        };
                    }
                    const { data: signed } = await supabase.storage
                        .from('lms-assets')
                        .createSignedUrl(asset.storage_path, 1800, { download: asset.name });
                    return {
                        name: asset.name,
                        type: asset.type,
                        isExemplar,
                        lockedUntilSubmit: false,
                        downloadUrl: signed?.signedUrl || null,
                    };
                }),
            );
        }

        return res.status(200).json({
            lesson: {
                id: lesson.id,
                module_id: lesson.module_id,
                module_title: mod?.title || '',
                course_title: mod?.lms_courses?.title || '',
                target_week: mod?.target_week || 1,
                lesson_type: lesson.lesson_type,
                title: lesson.title,
                global_order: lesson.global_order,
                estimated_minutes: lesson.estimated_minutes,
                // video
                video_signed_url: videoSignedUrl,
                r2_configured: r2Ready,
                duration_seconds: lesson.duration_seconds,
                chapters: lesson.chapters_json || [],
                // reading
                content_html: lesson.lesson_type === 'reading' ? lesson.content_html : null,
                word_count: lesson.word_count,
                min_dwell_seconds: lesson.min_dwell_seconds,
                // quiz (answer keys ALWAYS stripped!)
                quiz_questions: lesson.lesson_type === 'quiz' ? sanitizeQuizForClient(lesson.quiz_questions_json) : [],
                quiz_keys_verified: lesson.quiz_keys_verified,
                pass_threshold_pct: lesson.pass_threshold_pct,
                // project
                project_brief: lesson.project_brief,
                project_assets: projectAssetsWithUrls,
            },
            progress: progress || {
                status: 'in_progress',
                unique_watched_seconds: 0,
                max_watched_second: 0,
                last_position_seconds: 0,
                scroll_depth_pct: 0,
                active_dwell_seconds: 0,
                key_takeaway: '',
            },
            quizAttempts: attempts || [],
            projectSubmission: submission || null,
            navigation: {
                prev: prevLesson || null,
                next: nextLesson || null,
            },
        });
    } catch (err: any) {
        console.error('[lms/lesson] Error:', err);
        return res.status(500).json({ error: err?.message || 'Failed to load lesson' });
    }
}
