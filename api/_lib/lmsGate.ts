import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import { verifyAuth } from './auth.js';

export type WatchedRange = [number, number];

export interface LmsCohort {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    start_date: string; // YYYY-MM-DD
    target_end_date: string;
    pacing_mode: 'weekly_drip_sequential' | 'self_paced_sequential';
    drip_timezone: string;
    drip_unlock_hour: number;
    project_gate_mode: 'submit_to_unlock' | 'approve_to_unlock';
    is_active: boolean;
}

export interface LmsEnrollment {
    id: string;
    cohort_id: string;
    user_id: string;
    email: string;
    full_name: string;
    job_role: string;
    role: 'learner' | 'admin';
    peer_buddy_user_id: string | null;
    timezone: string;
    reminder_hour: number;
    weekend_reminders: boolean;
    email_paused_until: string | null;
    weekly_commitment_hours: number;
    onboarding_completed: boolean;
    current_streak: number;
    longest_streak: number;
    last_streak_date: string | null;
    last_active_at: string | null;
    status: string;
}

export interface QuizQuestion {
    id: string;
    prompt: string;
    type: 'single' | 'multi';
    options: string[];
    correct_indices?: number[];
    explanation?: string;
}

/**
 * Merges overlapping or adjacent [start, end] watched video intervals (in seconds)
 * so re-watching the same 30s segment cannot inflate unique watched duration.
 */
export function mergeWatchedRanges(ranges: WatchedRange[]): WatchedRange[] {
    const cleaned = ranges
        .filter((r) => Array.isArray(r) && r.length === 2 && Number.isFinite(r[0]) && Number.isFinite(r[1]))
        .map(([a, b]): WatchedRange => [Math.max(0, Math.floor(Math.min(a, b))), Math.max(0, Math.ceil(Math.max(a, b)))])
        .filter(([a, b]) => b > a)
        .sort((x, y) => x[0] - y[0]);

    if (cleaned.length === 0) return [];
    const merged: WatchedRange[] = [cleaned[0]];
    for (let i = 1; i < cleaned.length; i++) {
        const prev = merged[merged.length - 1];
        const cur = cleaned[i];
        if (cur[0] <= prev[1] + 2) {
            prev[1] = Math.max(prev[1], cur[1]);
        } else {
            merged.push(cur);
        }
    }
    return merged;
}

export function sumWatchedRanges(ranges: WatchedRange[]): number {
    return mergeWatchedRanges(ranges).reduce((acc, [a, b]) => acc + (b - a), 0);
}

/**
 * Computes the UTC Date when a module's Weekly Monday Drip becomes eligible.
 * Week 1 unlocks on cohort.start_date at drip_unlock_hour WAT (UTC+1).
 * Week N unlocks (N - 1) * 7 days after start_date at drip_unlock_hour WAT.
 */
export function getModuleDripUnlockAt(cohort: Pick<LmsCohort, 'start_date' | 'drip_unlock_hour'>, targetWeek: number): Date {
    const [year, month, day] = cohort.start_date.split('-').map(Number);
    // WAT is UTC+1 -> subtract 1 hour from local hour to get UTC hour
    const utcHour = (cohort.drip_unlock_hour ?? 7) - 1;
    const baseMs = Date.UTC(year, (month || 1) - 1, day || 1, utcHour, 0, 0);
    const offsetDays = Math.max(0, (targetWeek || 1) - 1) * 7;
    return new Date(baseMs + offsetDays * 86400 * 1000);
}

export function isModuleDripUnlocked(
    cohort: Pick<LmsCohort, 'start_date' | 'drip_unlock_hour' | 'pacing_mode'>,
    targetWeek: number,
    now = new Date(),
    hasDripOverride = false,
): { unlocked: boolean; unlocksAt: string } {
    const unlocksAtDate = getModuleDripUnlockAt(cohort, targetWeek);
    if (cohort.pacing_mode === 'self_paced_sequential' || hasDripOverride) {
        return { unlocked: true, unlocksAt: unlocksAtDate.toISOString() };
    }
    return {
        unlocked: now.getTime() >= unlocksAtDate.getTime(),
        unlocksAt: unlocksAtDate.toISOString(),
    };
}

/**
 * Strips correct_indices & explanations from quiz JSON before sending to learner client.
 */
export function sanitizeQuizForClient(questions: QuizQuestion[] | null | undefined): Array<Omit<QuizQuestion, 'correct_indices' | 'explanation'>> {
    if (!Array.isArray(questions)) return [];
    return questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        type: q.type,
        options: q.options,
    }));
}

/**
 * Returns the authenticated user + their active LMS enrollment + cohort.
 * Automatically bootstraps an admin enrollment if the user is a CortDevs platform Admin.
 */
export async function requireLmsMember(req: VercelRequest, res: VercelResponse): Promise<{
    user: any;
    enrollment: LmsEnrollment;
    cohort: LmsCohort;
} | null> {
    const user = await verifyAuth(req, res);
    if (!user) return null;

    // Fetch enrollment (including paused/removed so we can return clear block status)
    const { data: enrollments } = await supabase
        .from('lms_enrollments')
        .select('*, lms_cohorts(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

    let enrollmentRow = enrollments?.[0];

    if (enrollmentRow) {
        if (enrollmentRow.status === 'paused') {
            res.status(403).json({
                error: 'Your access has been temporarily suspended by your administrator.',
                code: 'TEMP_BLOCKED',
            });
            return null;
        }
        if (enrollmentRow.status === 'removed') {
            res.status(403).json({
                error: 'Your access to this learning portal has been permanently revoked.',
                code: 'PERM_BLOCKED',
            });
            return null;
        }
    }

    // If not enrolled yet, only platform admins auto-bootstrap
    if (!enrollmentRow) {
        const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();
        const role = profile?.role || user.user_metadata?.role;
        const isPlatformAdmin =
            ['Superadmin', 'Admin', 'superadmin', 'admin'].includes(role) ||
            ['projects@cortdevs.com', 'learn@cortdevs.com'].includes((user.email || '').toLowerCase());

        if (!isPlatformAdmin) {
            res.status(403).json({ error: 'Access denied. Contact your CortDevs administrator for an account.' });
            return null;
        }

        const { data: activeCohort } = await supabase
            .from('lms_cohorts')
            .select('id')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!activeCohort?.id) {
            res.status(404).json({ error: 'No active learning cohort exists yet.' });
            return null;
        }

        const { data: created, error: createErr } = await supabase
            .from('lms_enrollments')
            .insert({
                cohort_id: activeCohort.id,
                user_id: user.id,
                email: (user.email || '').toLowerCase(),
                full_name: user.user_metadata?.full_name || profile?.full_name || (user.email || '').split('@')[0],
                role: 'admin',
                onboarding_completed: true,
            })
            .select('*, lms_cohorts(*)')
            .single();

        if (createErr || !created) {
            res.status(500).json({ error: 'Failed to initialize admin enrollment', details: createErr?.message });
            return null;
        }

        enrollmentRow = created;
    }

    const cohort = enrollmentRow.lms_cohorts as LmsCohort;
    const { lms_cohorts: _, ...enrollment } = enrollmentRow;
    return { user, enrollment: enrollment as LmsEnrollment, cohort };
}

export async function requireLmsAdmin(req: VercelRequest, res: VercelResponse) {
    const member = await requireLmsMember(req, res);
    if (!member) return null;

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', member.user.id).maybeSingle();
    const platformRole = profile?.role || member.user.user_metadata?.role;
    const isAdmin =
        member.enrollment.role === 'admin' ||
        ['Superadmin', 'Admin', 'superadmin', 'admin'].includes(platformRole) ||
        ['projects@cortdevs.com', 'learn@cortdevs.com'].includes((member.user.email || '').toLowerCase());

    if (!isAdmin) {
        res.status(403).json({ error: 'Cohort administrator access required.' });
        return null;
    }
    return member;
}

/**
 * Evaluates dual-lock access for a single lesson:
 *   1. Weekly Monday Drip Gate (module.target_week)
 *   2. Strict Sequential Prerequisite Gate (lesson global_order - 1 must be completed)
 * Admins can preview any lesson; overrides bypass either lock cleanly.
 */
export async function evaluateLessonAccess(params: {
    cohort: LmsCohort;
    enrollment: LmsEnrollment;
    lessonId: string;
}): Promise<{
    allowed: boolean;
    reason?: 'drip_locked' | 'prerequisite_locked' | 'not_found';
    unlocksAt?: string;
    prerequisiteLessonId?: string;
    prerequisiteTitle?: string;
    lesson?: any;
    module?: any;
}> {
    const { cohort, enrollment, lessonId } = params;

    const { data: lesson } = await supabase
        .from('lms_lessons')
        .select('*, lms_modules(*, lms_courses(*))')
        .eq('id', lessonId)
        .maybeSingle();

    if (!lesson) return { allowed: false, reason: 'not_found' };

    const mod = lesson.lms_modules;

    // Fetch overrides for this user or cohort-wide
    const { data: overrides } = await supabase
        .from('lms_overrides')
        .select('*')
        .eq('cohort_id', cohort.id)
        .or(`user_id.is.null,user_id.eq.${enrollment.user_id}`);

    const hasDripOverride = (overrides || []).some(
        (o: any) => o.override_type === 'unlock_drip' && (!o.module_id || o.module_id === mod.id),
    );
    const hasLessonOverride = (overrides || []).some(
        (o: any) => o.override_type === 'unlock_lesson' && (o.lesson_id === lesson.id || o.module_id === mod.id),
    );

    // 1. Check Weekly Monday Drip Gate
    const drip = isModuleDripUnlocked(cohort, mod.target_week, new Date(), hasDripOverride || enrollment.role === 'admin');
    if (!drip.unlocked) {
        return {
            allowed: false,
            reason: 'drip_locked',
            unlocksAt: drip.unlocksAt,
            lesson,
            module: mod,
        };
    }

    // 2. Check Strict Sequential Prerequisite Gate
    if (lesson.global_order > 1 && !hasLessonOverride && enrollment.role !== 'admin') {
        const { data: prevLesson } = await supabase
            .from('lms_lessons')
            .select('id, title, global_order')
            .eq('global_order', lesson.global_order - 1)
            .maybeSingle();

        if (prevLesson) {
            const { data: prevProgress } = await supabase
                .from('lms_lesson_progress')
                .select('status')
                .eq('cohort_id', cohort.id)
                .eq('user_id', enrollment.user_id)
                .eq('lesson_id', prevLesson.id)
                .maybeSingle();

            if (prevProgress?.status !== 'completed') {
                return {
                    allowed: false,
                    reason: 'prerequisite_locked',
                    prerequisiteLessonId: prevLesson.id,
                    prerequisiteTitle: prevLesson.title,
                    lesson,
                    module: mod,
                };
            }
        }
    }

    return { allowed: true, lesson, module: mod, unlocksAt: drip.unlocksAt };
}

/**
 * Updates learner's daily streak & last_active_at whenever they complete a lesson or log study activity.
 */
export async function touchLearnerStreak(enrollment: LmsEnrollment): Promise<{ currentStreak: number; longestStreak: number }> {
    const todayIso = new Date().toISOString().slice(0, 10);
    const lastDate = enrollment.last_streak_date;

    let currentStreak = enrollment.current_streak || 0;
    let longestStreak = enrollment.longest_streak || 0;

    if (lastDate !== todayIso) {
        if (lastDate) {
            const diffDays = Math.round(
                (new Date(`${todayIso}T00:00:00Z`).getTime() - new Date(`${lastDate}T00:00:00Z`).getTime()) / 86400000,
            );
            currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
        } else {
            currentStreak = 1;
        }
        longestStreak = Math.max(longestStreak, currentStreak);
    }

    await supabase
        .from('lms_enrollments')
        .update({
            current_streak: currentStreak,
            longest_streak: longestStreak,
            last_streak_date: todayIso,
            last_active_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', enrollment.id);

    return { currentStreak, longestStreak };
}

export async function logLmsEvent(params: {
    cohortId: string;
    userId: string;
    lessonId?: string | null;
    eventType: string;
    metadata?: Record<string, any>;
}) {
    await supabase.from('lms_activity_events').insert({
        cohort_id: params.cohortId,
        user_id: params.userId,
        lesson_id: params.lessonId || null,
        event_type: params.eventType,
        metadata: params.metadata || {},
    });
}
