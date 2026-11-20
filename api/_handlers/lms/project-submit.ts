import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import {
    evaluateLessonAccess,
    logLmsEvent,
    requireLmsMember,
    sanitizePlainText,
    sanitizeSingleLine,
    touchLearnerStreak,
} from '../../_lib/lmsGate.js';
import { sendLmsProjectSubmitted } from '../../_lib/lmsEmail.js';
import { checkAndNotifyModuleCompletion } from './progress-complete.js';

const ALLOWED_EXTENSIONS = new Set(['docx', 'doc', 'xlsx', 'xls', 'csv', 'pdf', 'pptx', 'ppt', 'png', 'jpg', 'jpeg', 'txt', 'md', 'zip']);

function isValidHttpUrl(input: string): boolean {
    try {
        const parsed = new URL(input);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
        return false;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const member = await requireLmsMember(req, res);
    if (!member) return;

    const { action = 'submit', lessonId, fileName, fileStoragePath, externalUrl, reflectionNotes } = req.body || {};
    if (!lessonId) return res.status(400).json({ error: 'lessonId required' });

    const access = await evaluateLessonAccess({
        cohort: member.cohort,
        enrollment: member.enrollment,
        lessonId: String(lessonId),
        includeContent: false,
    });
    if (!access.allowed) {
        return res.status(403).json({ error: 'Lesson locked', reason: access.reason });
    }

    const lesson = access.lesson;
    if (lesson.lesson_type !== 'project') {
        return res.status(400).json({ error: 'This lesson is not a project assignment.' });
    }

    const expectedPrefix = `submissions/${member.cohort.id}/${member.enrollment.user_id}/${lesson.id}/`;

    // Step 1: Request a signed upload URL to private Supabase Storage bucket 'lms-assets'
    if (action === 'upload_url') {
        const rawName = String(fileName || 'deliverable.docx').slice(0, 140);
        const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const ext = (safeName.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return res.status(400).json({
                error: `Unsupported file type (.${ext || 'unknown'}). Allowed: .docx, .xlsx, .pdf, .pptx, .png, .jpg, .csv, .zip`,
            });
        }

        const storagePath = `${expectedPrefix}${Date.now()}-${safeName}`;
        const { data, error } = await supabase.storage.from('lms-assets').createSignedUploadUrl(storagePath);
        if (error || !data) {
            return res.status(500).json({ error: error?.message || 'Failed to generate upload URL' });
        }
        return res.status(200).json({
            uploadUrl: data.signedUrl,
            token: data.token,
            storagePath,
        });
    }

    // Step 2: Finalize submission & auto-unlock next lesson (async review mode)
    const cleanReflection = sanitizePlainText(reflectionNotes, 5000);
    const cleanUrl = sanitizeSingleLine(externalUrl, 1000).replace(/\s+/g, '');
    const cleanPath = fileStoragePath ? String(fileStoragePath).trim() : '';
    const cleanFileName = fileName ? sanitizeSingleLine(fileName, 160) : null;

    if (cleanUrl && !isValidHttpUrl(cleanUrl)) {
        return res.status(400).json({ error: 'External link must start with https:// or http://' });
    }

    // Security check: strictly enforce that fileStoragePath belongs to THIS user, cohort, and lesson (prevents IDOR / path hijacking)
    if (cleanPath) {
        if (!cleanPath.startsWith(expectedPrefix) || cleanPath.includes('..') || cleanPath.includes('\0')) {
            return res.status(403).json({ error: 'Invalid upload file path.' });
        }
    }

    if (!cleanPath && !cleanUrl) {
        return res.status(400).json({ error: 'Upload a file or provide a link (Figma / Google Doc / Sheet).' });
    }
    if (cleanReflection.length < 40) {
        return res.status(400).json({ error: 'Include a brief reflection (at least 40 characters).' });
    }

    const nowIso = new Date().toISOString();
    const { data: submission, error: subErr } = await supabase
        .from('lms_project_submissions')
        .upsert(
            {
                cohort_id: member.cohort.id,
                user_id: member.enrollment.user_id,
                lesson_id: lesson.id,
                file_storage_path: cleanPath || null,
                file_name: cleanFileName,
                external_url: cleanUrl || null,
                reflection_notes: cleanReflection,
                review_status: 'submitted',
                peer_buddy_id: member.enrollment.peer_buddy_user_id || null,
                submitted_at: nowIso,
                updated_at: nowIso,
            },
            { onConflict: 'cohort_id,user_id,lesson_id' },
        )
        .select('*')
        .single();

    if (subErr) return res.status(500).json({ error: subErr.message });

    const autoUnlock = member.cohort.project_gate_mode !== 'approve_to_unlock';
    if (autoUnlock) {
        await supabase.from('lms_lesson_progress').upsert(
            {
                cohort_id: member.cohort.id,
                user_id: member.enrollment.user_id,
                lesson_id: lesson.id,
                status: 'completed',
                key_takeaway: cleanReflection.slice(0, 280),
                completed_at: nowIso,
                updated_at: nowIso,
            },
            { onConflict: 'cohort_id,user_id,lesson_id' },
        );
    }

    const { currentStreak } = await touchLearnerStreak(member.enrollment);

    await logLmsEvent({
        cohortId: member.cohort.id,
        userId: member.enrollment.user_id,
        lessonId: lesson.id,
        eventType: 'project_submitted',
        metadata: { title: lesson.title, hasFile: Boolean(cleanPath), hasUrl: Boolean(cleanUrl) },
    });

    const [{ data: admins }, { data: buddy }] = await Promise.all([
        supabase
            .from('lms_enrollments')
            .select('email')
            .eq('cohort_id', member.cohort.id)
            .eq('role', 'admin')
            .eq('status', 'active'),
        member.enrollment.peer_buddy_user_id
            ? supabase
                  .from('lms_enrollments')
                  .select('email')
                  .eq('cohort_id', member.cohort.id)
                  .eq('user_id', member.enrollment.peer_buddy_user_id)
                  .maybeSingle()
            : Promise.resolve({ data: null }),
    ]);

    await sendLmsProjectSubmitted({
        learnerEmail: member.enrollment.email,
        learnerName: member.enrollment.full_name,
        projectTitle: lesson.title,
        adminEmails: (admins || []).map((a: any) => a.email),
        peerBuddyEmail: buddy?.email || null,
        cohortId: member.cohort.id,
        userId: member.enrollment.user_id,
        lessonId: lesson.id,
    }).catch((e) => console.error('[lms/project-submit] Email error:', e));

    if (autoUnlock) {
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
    }

    const { data: nextLesson } = await supabase
        .from('lms_lessons')
        .select('id, title, lesson_type')
        .eq('global_order', lesson.global_order + 1)
        .maybeSingle();

    return res.status(200).json({
        ok: true,
        autoUnlocked: autoUnlock,
        submission,
        nextLesson: nextLesson || null,
    });
}
