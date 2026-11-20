import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { isValidUuid, logLmsEvent, requireLmsAdmin, sanitizePlainText } from '../../../_lib/lmsGate.js';
import { sendLmsProjectReviewed } from '../../../_lib/lmsEmail.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await requireLmsAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        const { data: rows, error } = await supabase
            .from('lms_project_submissions')
            .select('*, lms_lessons(id, title, module_id, lms_modules(title))')
            .eq('cohort_id', admin.cohort.id)
            .order('submitted_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        const userIds = [...new Set((rows || []).map((r: any) => r.user_id))];
        const userMap = new Map<string, { full_name: string; email: string }>();
        if (userIds.length > 0) {
            const { data: members } = await supabase
                .from('lms_enrollments')
                .select('user_id, full_name, email')
                .eq('cohort_id', admin.cohort.id)
                .in('user_id', userIds);
            for (const m of members || []) userMap.set(m.user_id, { full_name: m.full_name, email: m.email });
        }

        const enriched = await Promise.all(
            (rows || []).map(async (r: any) => {
                let downloadUrl: string | null = null;
                if (r.file_storage_path) {
                    const { data: signed } = await supabase.storage
                        .from('lms-assets')
                        .createSignedUrl(r.file_storage_path, 1800, { download: r.file_name || 'submission' });
                    downloadUrl = signed?.signedUrl || null;
                }
                const learner = userMap.get(r.user_id);
                return {
                    ...r,
                    learner_name: learner?.full_name || 'Learner',
                    learner_email: learner?.email || '',
                    lesson_title: r.lms_lessons?.title || 'Project',
                    module_title: r.lms_lessons?.lms_modules?.title || '',
                    download_url: downloadUrl,
                };
            }),
        );

        return res.status(200).json({ submissions: enriched });
    }

    if (req.method === 'PATCH') {
        const { submissionId, reviewStatus, feedback } = req.body || {};
        if (!isValidUuid(submissionId) || !['approved', 'revision_requested'].includes(reviewStatus)) {
            return res.status(400).json({ error: 'Valid submissionId and reviewStatus (approved | revision_requested) required.' });
        }

        const cleanFeedback = sanitizePlainText(feedback, 2000);

        const { data: sub, error } = await supabase
            .from('lms_project_submissions')
            .update({
                review_status: reviewStatus,
                reviewer_id: admin.user.id,
                reviewer_feedback: cleanFeedback,
                reviewed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', submissionId)
            .eq('cohort_id', admin.cohort.id)
            .select('*, lms_lessons(title)')
            .single();

        if (error || !sub) return res.status(500).json({ error: error?.message || 'Failed to save review' });

        const { data: learner } = await supabase
            .from('lms_enrollments')
            .select('email, full_name')
            .eq('cohort_id', admin.cohort.id)
            .eq('user_id', sub.user_id)
            .maybeSingle();

        await logLmsEvent({
            cohortId: admin.cohort.id,
            userId: sub.user_id,
            lessonId: sub.lesson_id,
            eventType: `project_${reviewStatus}`,
            metadata: { reviewerId: admin.user.id },
        });

        if (learner?.email) {
            await sendLmsProjectReviewed({
                to: learner.email,
                learnerName: learner.full_name,
                projectTitle: (sub.lms_lessons as any)?.title || 'Project Deliverable',
                status: reviewStatus,
                feedback: cleanFeedback,
                lessonId: sub.lesson_id,
                cohortId: admin.cohort.id,
                userId: sub.user_id,
            }).catch((e) => console.error('[admin/lms/reviews] Email error:', e));
        }

        return res.status(200).json({ submission: sub });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
