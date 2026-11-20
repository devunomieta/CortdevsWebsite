import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { logLmsEvent, requireLmsMember } from '../../_lib/lmsGate.js';
import { getLearnAppUrl } from '../../_lib/appUrl.js';

const DEFAULT_PROGRAM_TITLE = 'AI Product Management';

const ATTRIBUTION_NOTE =
    'Completed the 12-week CortDevs AI Product Management program guided by Microsoft AI Product Manager study materials (covering Enterprise Product Management, Market Research, AI Product Strategy & Roadmapping, UX/UI Design, and Post-Launch AI Operations), independently managed, tracked, and verified by CortDevs.';

function normalizeProgramTitle(title?: string | null): string {
    if (!title) return DEFAULT_PROGRAM_TITLE;
    return title.replace(/\s*Training\s*Cohort\s*$/i, '').trim() || DEFAULT_PROGRAM_TITLE;
}

const DISCLAIMER_NOTE =
    'Issued independently by CortDevs for verified internal cohort completion. Not affiliated with, sponsored by, or officially certified by Microsoft or Coursera.';

function generateCertCode(): string {
    const year = new Date().getUTCFullYear();
    const token = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
    return `CD-AIPM-${year}-${token}`;
}

async function computeEligibility(cohortId: string, userId: string) {
    const [
        { count: totalLessonsCount },
        { count: completedLessonsCount },
        { data: projectLessons },
        { data: approvedSubs },
        { data: quizAttempts },
    ] = await Promise.all([
        supabase.from('lms_lessons').select('id', { count: 'exact', head: true }),
        supabase
            .from('lms_lesson_progress')
            .select('id', { count: 'exact', head: true })
            .eq('cohort_id', cohortId)
            .eq('user_id', userId)
            .eq('status', 'completed'),
        supabase.from('lms_lessons').select('id').eq('lesson_type', 'project'),
        supabase
            .from('lms_project_submissions')
            .select('lesson_id')
            .eq('cohort_id', cohortId)
            .eq('user_id', userId)
            .eq('review_status', 'approved'),
        supabase
            .from('lms_quiz_attempts')
            .select('lesson_id, score_pct, passed')
            .eq('cohort_id', cohortId)
            .eq('user_id', userId)
            .eq('passed', true),
    ]);

    const totalLessons = totalLessonsCount || 0;
    const completedLessons = completedLessonsCount || 0;
    const totalProjects = (projectLessons || []).length;
    const approvedProjects = new Set((approvedSubs || []).map((s: any) => s.lesson_id)).size;

    // Best passed score per quiz
    const bestByQuiz = new Map<string, number>();
    for (const q of quizAttempts || []) {
        const sc = Number(q.score_pct || 0);
        bestByQuiz.set(q.lesson_id, Math.max(bestByQuiz.get(q.lesson_id) || 0, sc));
    }
    const avgQuizScore =
        bestByQuiz.size > 0
            ? Math.round((Array.from(bestByQuiz.values()).reduce((a, b) => a + b, 0) / bestByQuiz.size) * 10) / 10
            : null;

    const eligible = totalLessons > 0 && completedLessons >= totalLessons && approvedProjects >= totalProjects;

    return {
        eligible,
        completedLessons,
        totalLessons,
        approvedProjects,
        totalProjects,
        avgQuizScore,
    };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. PUBLIC VERIFICATION ENDPOINT: GET /api/lms/certificate?code=CD-AIPM-2026-XXXXXX
    if (req.method === 'GET' && req.query?.code) {
        const code = String(req.query.code).trim().toUpperCase();
        if (!/^CD-[A-Z0-9-]{6,32}$/.test(code)) {
            return res.status(400).json({ valid: false, error: 'Invalid certificate code format.' });
        }

        const { data: cert } = await supabase
            .from('lms_certificates')
            .select('*, lms_cohorts(name, start_date, target_end_date)')
            .eq('certificate_code', code)
            .maybeSingle();

        if (!cert) {
            return res.status(404).json({ valid: false, error: 'No verified CortDevs certificate was found for this code.' });
        }

        if (cert.revoked_at) {
            return res.status(200).json({
                valid: false,
                revoked: true,
                error: 'This certificate has been revoked by CortDevs.',
            });
        }

        return res.status(200).json({
            valid: true,
            certificate: {
                certificate_code: cert.certificate_code,
                recipient_name: cert.recipient_name,
                program_title: normalizeProgramTitle(cert.program_title),
                cohort_name: (cert.lms_cohorts as any)?.name || 'CortDevs AI Product Management',
                issued_by_name: cert.issued_by_name,
                issued_by_title: cert.issued_by_title,
                completed_lessons: cert.completed_lessons,
                total_lessons: cert.total_lessons,
                approved_projects: cert.approved_projects,
                total_projects: cert.total_projects,
                avg_quiz_score: cert.avg_quiz_score,
                issued_at: cert.issued_at,
                verify_url: `${getLearnAppUrl()}/verify/${cert.certificate_code}`,
                attribution_note: ATTRIBUTION_NOTE,
                disclaimer: DISCLAIMER_NOTE,
            },
        });
    }

    // 2. AUTHENTICATED LEARNER / ADMIN ENDPOINTS
    const member = await requireLmsMember(req, res);
    if (!member) return;

    if (req.method === 'GET') {
        const [eligibility, { data: existing }] = await Promise.all([
            computeEligibility(member.cohort.id, member.enrollment.user_id),
            supabase
                .from('lms_certificates')
                .select('*')
                .eq('cohort_id', member.cohort.id)
                .eq('user_id', member.enrollment.user_id)
                .maybeSingle(),
        ]);

        return res.status(200).json({
            eligibility,
            canIssue: eligibility.eligible || member.enrollment.role === 'admin',
            isAdminPreview: !eligibility.eligible && member.enrollment.role === 'admin',
            defaultName: member.enrollment.full_name,
            certificate: existing
                ? {
                      ...existing,
                      program_title: normalizeProgramTitle(existing.program_title),
                      cohort_name: member.cohort.name,
                      verify_url: `${getLearnAppUrl()}/verify/${existing.certificate_code}`,
                      attribution_note: ATTRIBUTION_NOTE,
                      disclaimer: DISCLAIMER_NOTE,
                  }
                : null,
        });
    }

    if (req.method === 'POST') {
        const cleanName = String(req.body?.recipientName || '').trim().slice(0, 120);
        if (cleanName.length < 2) {
            return res.status(400).json({ error: 'Please enter the full name to appear on your certificate.' });
        }

        const eligibility = await computeEligibility(member.cohort.id, member.enrollment.user_id);
        const isAdmin = member.enrollment.role === 'admin';

        if (!eligibility.eligible && !isAdmin) {
            return res.status(403).json({
                error: `Complete all lessons (${eligibility.completedLessons}/${eligibility.totalLessons}) and get all projects approved (${eligibility.approvedProjects}/${eligibility.totalProjects}) to unlock your certificate.`,
                eligibility,
            });
        }

        // Check if already issued — allow updating recipient_name cleanly without changing certificate_code
        const { data: existing } = await supabase
            .from('lms_certificates')
            .select('*')
            .eq('cohort_id', member.cohort.id)
            .eq('user_id', member.enrollment.user_id)
            .maybeSingle();

        let saved: any = null;
        if (existing) {
            const { data: updated, error } = await supabase
                .from('lms_certificates')
                .update({
                    recipient_name: cleanName,
                    program_title: DEFAULT_PROGRAM_TITLE,
                    completed_lessons: eligibility.completedLessons,
                    total_lessons: eligibility.totalLessons,
                    approved_projects: eligibility.approvedProjects,
                    total_projects: eligibility.totalProjects,
                    avg_quiz_score: eligibility.avgQuizScore,
                })
                .eq('id', existing.id)
                .select('*')
                .single();
            if (error) return res.status(500).json({ error: error.message });
            saved = updated;
        } else {
            const code = generateCertCode();
            const { data: created, error } = await supabase
                .from('lms_certificates')
                .insert({
                    certificate_code: code,
                    cohort_id: member.cohort.id,
                    user_id: member.enrollment.user_id,
                    recipient_name: cleanName,
                    program_title: DEFAULT_PROGRAM_TITLE,
                    issued_by_name: 'Joseph Unomieta',
                    issued_by_title: 'Program Manager, CortDevs',
                    completed_lessons: eligibility.completedLessons,
                    total_lessons: eligibility.totalLessons,
                    approved_projects: eligibility.approvedProjects,
                    total_projects: eligibility.totalProjects,
                    avg_quiz_score: eligibility.avgQuizScore,
                })
                .select('*')
                .single();
            if (error) return res.status(500).json({ error: error.message });
            saved = created;

            await logLmsEvent({
                cohortId: member.cohort.id,
                userId: member.enrollment.user_id,
                eventType: 'certificate_issued',
                metadata: { certificateCode: code, recipientName: cleanName },
            });
        }

        return res.status(200).json({
            certificate: {
                ...saved,
                cohort_name: member.cohort.name,
                verify_url: `${getLearnAppUrl()}/verify/${saved.certificate_code}`,
                attribution_note: ATTRIBUTION_NOTE,
                disclaimer: DISCLAIMER_NOTE,
            },
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
