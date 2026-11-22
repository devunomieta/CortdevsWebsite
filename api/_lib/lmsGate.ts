import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import { verifyAuth } from './auth.js';

export type WatchedRange = [number, number];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LESSON_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{2,140}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Strips ASCII control chars (except \n, \t) and Unicode zero-width / BiDi spoofing characters
// eslint-disable-next-line no-control-regex
const UNSAFE_CTRL_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;

/**
 * Sanitizes multi-line plain-text input (reflections, takeaways, Q&A bodies, feedback, nudges):
 * removes control/BiDi spoofing chars and raw HTML tags, trims, and enforces a strict max length.
 */
export function sanitizePlainText(input: unknown, maxLen: number): string {
    if (typeof input !== 'string') return '';
    return input
        .replace(UNSAFE_CTRL_REGEX, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\r\n?/g, '\n')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim()
        .slice(0, maxLen);
}

/**
 * Sanitizes single-line plain-text input (names, titles, job roles, filenames, cohort names).
 */
export function sanitizeSingleLine(input: unknown, maxLen: number): string {
    return sanitizePlainText(input, maxLen * 2)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen);
}

export function isValidUuid(input: unknown): input is string {
    return typeof input === 'string' && UUID_REGEX.test(input.trim());
}

export function isValidLessonSlug(input: unknown): input is string {
    return typeof input === 'string' && LESSON_SLUG_REGEX.test(input.trim());
}

export function isValidLessonIdentifier(input: unknown): input is string {
    return isValidUuid(input) || isValidLessonSlug(input);
}

export function isValidEmail(input: unknown): input is string {
    return typeof input === 'string' && input.trim().length <= 254 && EMAIL_REGEX.test(input.trim());
}

// Relaxed, non-disruptive pacing guards (balanced to allow scanning/jumping while preventing instant rush clicks)
export const VIDEO_COMPLETE_MIN_PCT = 70;
export const READING_COMPLETE_MIN_SCROLL = 65;
export const READING_TAKEAWAY_MIN_CHARS = 20;

export function getEffectiveReadingMinDwell(rawMinDwell?: number | null): number {
    const base = Number(rawMinDwell) || 60;
    return Math.min(45, Math.max(15, Math.round(base * 0.25)));
}

export interface DialogueAccessResult {
    unlocked: boolean;
    reason: string | null;
    gateLessonSlug: string | null;
    gateLessonTitle: string | null;
}

/**
 * Checks whether Module Dialogue & AI Coach are unlocked for a learner in a given module:
 *  - Admins always have preview access.
 *  - If the module has quizzes and/or projects, ALL quizzes & projects in that module must be completed first.
 *  - Otherwise (e.g., Course 0 Orientation), all lessons in that module must be completed first.
 */
export async function checkModuleDialogueUnlocked(params: {
    cohortId: string;
    userId: string;
    moduleId: string;
    isAdmin: boolean;
}): Promise<DialogueAccessResult> {
    if (params.isAdmin) {
        return { unlocked: true, reason: null, gateLessonSlug: null, gateLessonTitle: null };
    }

    const { data: modLessons } = await supabase
        .from('lms_lessons')
        .select('id, slug, title, lesson_type, order_index')
        .eq('module_id', params.moduleId)
        .order('order_index', { ascending: true });

    const all = modLessons || [];
    if (!all.length) {
        return { unlocked: true, reason: null, gateLessonSlug: null, gateLessonTitle: null };
    }

    const assessmentLessons = all.filter((l: any) => l.lesson_type === 'quiz' || l.lesson_type === 'project');
    const gateLessons = assessmentLessons.length > 0 ? assessmentLessons : all;
    const gateIds = gateLessons.map((l: any) => l.id);

    const { data: doneRows } = await supabase
        .from('lms_lesson_progress')
        .select('lesson_id')
        .eq('cohort_id', params.cohortId)
        .eq('user_id', params.userId)
        .eq('status', 'completed')
        .in('lesson_id', gateIds);

    const doneSet = new Set<string>((doneRows || []).map((r: any) => r.lesson_id));
    const firstMissing = gateLessons.find((l: any) => !doneSet.has(l.id));

    if (!firstMissing) {
        return { unlocked: true, reason: null, gateLessonSlug: null, gateLessonTitle: null };
    }

    const hasProject = assessmentLessons.some((l: any) => l.lesson_type === 'project');
    const hasQuiz = assessmentLessons.some((l: any) => l.lesson_type === 'quiz');
    const gateDesc =
        hasQuiz && hasProject
            ? 'this module’s quizzes and project'
            : hasProject
              ? 'this module’s project'
              : hasQuiz
                ? 'this module’s quiz'
                : 'this module’s lesson';

    return {
        unlocked: false,
        reason: `Complete ${gateDesc} first to unlock the BAFOS Module Dialogue & AI Coach.`,
        gateLessonSlug: firstMissing.slug || firstMissing.id,
        gateLessonTitle: firstMissing.title,
    };
}

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
    week_extensions_json?: Record<string, number> | null;
    weekly_leads_json?: Record<string, string> | null;
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
    study_group_name?: string | null;
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

const BASE_COHORT_WEEKS = 12;

/**
 * Normalizes a week_extensions_json map ({ "3": 1, "7": 2 }):
 * keys must be curriculum weeks 1..12, values are extra weeks (0..4).
 */
export function normalizeWeekExtensions(raw: unknown): Record<string, number> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        const wk = Number(k);
        const extra = Math.floor(Number(v));
        if (Number.isInteger(wk) && wk >= 1 && wk <= BASE_COHORT_WEEKS && Number.isFinite(extra) && extra > 0) {
            out[String(wk)] = Math.min(4, extra);
        }
    }
    return out;
}

/**
 * Normalizes a weekly_leads_json map ({ "1": "<user_uuid>", "2": "<user_uuid>" }):
 * keys must be curriculum weeks 1..12, values must be valid UUIDs.
 */
export function normalizeWeeklyLeads(raw: unknown): Record<string, string> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        const wk = Number(k);
        if (Number.isInteger(wk) && wk >= 1 && wk <= BASE_COHORT_WEEKS && isValidUuid(v)) {
            out[String(wk)] = v.trim();
        }
    }
    return out;
}

export function getCohortTotalWeeks(cohort: Pick<LmsCohort, 'week_extensions_json'>): number {
    const ext = normalizeWeekExtensions(cohort.week_extensions_json);
    const totalExtra = Object.values(ext).reduce((sum, n) => sum + n, 0);
    return BASE_COHORT_WEEKS + totalExtra;
}

export function getCohortTargetEndDate(startDate: string, rawExtensions?: unknown): string {
    const ext = normalizeWeekExtensions(rawExtensions);
    const totalWeeks = BASE_COHORT_WEEKS + Object.values(ext).reduce((sum, n) => sum + n, 0);
    const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
    return new Date(startMs + totalWeeks * 7 * 86400 * 1000).toISOString().slice(0, 10);
}

/**
 * Computes the UTC Date when a module's Weekly Monday Drip becomes eligible,
 * automatically cascading forward any extra weeks granted to earlier curriculum weeks.
 */
export function getModuleDripUnlockAt(
    cohort: Pick<LmsCohort, 'start_date' | 'drip_unlock_hour' | 'week_extensions_json'>,
    targetWeek: number,
): Date {
    const [year, month, day] = cohort.start_date.split('-').map(Number);
    // WAT is UTC+1 -> subtract 1 hour from local hour to get UTC hour
    const utcHour = (cohort.drip_unlock_hour ?? 7) - 1;
    const baseMs = Date.UTC(year, (month || 1) - 1, day || 1, utcHour, 0, 0);
    const ext = normalizeWeekExtensions(cohort.week_extensions_json);
    const clampedWeek = Math.max(1, Math.min(BASE_COHORT_WEEKS, Math.floor(targetWeek || 1)));
    let extraWeeksBefore = 0;
    for (let w = 1; w < clampedWeek; w++) {
        extraWeeksBefore += ext[String(w)] || 0;
    }
    const offsetDays = (clampedWeek - 1 + extraWeeksBefore) * 7;
    return new Date(baseMs + offsetDays * 86400 * 1000);
}

export function buildCohortWeekSchedule(cohort: Pick<LmsCohort, 'start_date' | 'drip_unlock_hour' | 'week_extensions_json'>) {
    const ext = normalizeWeekExtensions(cohort.week_extensions_json);
    const schedule: Array<{
        week: number;
        extraWeeks: number;
        durationWeeks: number;
        unlockDate: string;
        deadlineDate: string;
    }> = [];
    for (let w = 1; w <= BASE_COHORT_WEEKS; w++) {
        const extra = ext[String(w)] || 0;
        const durationWeeks = 1 + extra;
        const unlockAt = getModuleDripUnlockAt(cohort, w);
        // Deadline is the Sunday night at the end of the week window (unlock + duration*7 - 1 day)
        const deadlineMs = unlockAt.getTime() + (durationWeeks * 7 - 1) * 86400 * 1000;
        schedule.push({
            week: w,
            extraWeeks: extra,
            durationWeeks,
            unlockDate: new Date(unlockAt.getTime() + 3600 * 1000).toISOString().slice(0, 10),
            deadlineDate: new Date(deadlineMs + 3600 * 1000).toISOString().slice(0, 10),
        });
    }
    return schedule;
}

export function getCurrentCohortWeek(
    cohort: Pick<LmsCohort, 'start_date' | 'drip_unlock_hour' | 'week_extensions_json'>,
    now = new Date(),
): number {
    let activeWeek = 1;
    for (let w = 1; w <= BASE_COHORT_WEEKS; w++) {
        const unlockAt = getModuleDripUnlockAt(cohort, w);
        if (now.getTime() >= unlockAt.getTime()) {
            activeWeek = w;
        }
    }
    return activeWeek;
}

export function isModuleDripUnlocked(
    cohort: Pick<LmsCohort, 'start_date' | 'drip_unlock_hour' | 'pacing_mode' | 'week_extensions_json'>,
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
 *
 * By default (`includeContent: false`), selects ONLY lightweight lesson metadata
 * (never `content_html` or `quiz_questions_json`) to minimize Supabase free-tier egress!
 */
export async function evaluateLessonAccess(params: {
    cohort: LmsCohort;
    enrollment: LmsEnrollment;
    lessonId: string;
    includeContent?: boolean;
}): Promise<{
    allowed: boolean;
    reason?: 'drip_locked' | 'prerequisite_locked' | 'not_found';
    unlocksAt?: string;
    prerequisiteLessonId?: string;
    prerequisiteLessonSlug?: string;
    prerequisiteTitle?: string;
    lesson?: any;
    module?: any;
}> {
    const { cohort, enrollment, lessonId, includeContent = false } = params;
    const cleanRef = String(lessonId || '').trim();
    if (!isValidLessonIdentifier(cleanRef)) {
        return { allowed: false, reason: 'not_found' };
    }

    const lessonColumns = includeContent
        ? '*, lms_modules(id, title, target_week, global_order, lms_courses(id, title))'
        : 'id, module_id, slug, order_index, global_order, lesson_type, title, estimated_minutes, duration_seconds, min_dwell_seconds, pass_threshold_pct, quiz_keys_verified, lms_modules(id, title, target_week, global_order, lms_courses(id, title))';

    const lookupCol = isValidUuid(cleanRef) ? 'id' : 'slug';
    const { data: lesson } = await supabase
        .from('lms_lessons')
        .select(lessonColumns)
        .eq(lookupCol, lookupCol === 'slug' ? cleanRef.toLowerCase() : cleanRef)
        .maybeSingle();

    if (!lesson) return { allowed: false, reason: 'not_found' };

    const mod = (lesson as any).lms_modules;

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

    // 2. Module-Gated, Flexible Within-Module Prerequisite Gate:
    //    - Between modules: strictly global — ALL lessons in earlier modules must be completed first.
    //    - Inside an unlocked module: Module Video + all Readings unlock together as supporting materials;
    //      Quizzes unlock once Video + Readings are done; Module Project unlocks once Video + Readings + Quizzes are done.
    if (lesson.global_order > 1 && !hasLessonOverride && enrollment.role !== 'admin') {
        const [{ data: moduleLessons }, { data: completedRows }] = await Promise.all([
            supabase
                .from('lms_lessons')
                .select('id, slug, title, module_id, lesson_type, global_order, order_index')
                .eq('module_id', lesson.module_id)
                .order('global_order', { ascending: true }),
            supabase
                .from('lms_lesson_progress')
                .select('lesson_id')
                .eq('cohort_id', cohort.id)
                .eq('user_id', enrollment.user_id)
                .eq('status', 'completed'),
        ]);

        const completedSet = new Set<string>((completedRows || []).map((r: any) => r.lesson_id));
        const modList = moduleLessons || [];
        const firstGlobalInMod = modList.length > 0 ? modList[0].global_order : lesson.global_order;

        // 2a. Strict Global Gate between modules: verify every lesson before this module is completed
        if (firstGlobalInMod > 1) {
            const { data: earlierLessons } = await supabase
                .from('lms_lessons')
                .select('id, slug, title, global_order')
                .lt('global_order', firstGlobalInMod)
                .order('global_order', { ascending: true });

            const firstMissingEarlier = (earlierLessons || []).find((l: any) => !completedSet.has(l.id));
            if (firstMissingEarlier) {
                return {
                    allowed: false,
                    reason: 'prerequisite_locked',
                    prerequisiteLessonId: firstMissingEarlier.id,
                    prerequisiteLessonSlug: firstMissingEarlier.slug,
                    prerequisiteTitle: firstMissingEarlier.title,
                    lesson,
                    module: mod,
                };
            }
        }

        // 2b. Within this unlocked module:
        //     - video & reading: all unlocked together
        //     - quiz: requires this module's video + readings completed
        //     - project: requires this module's video + readings + quizzes completed
        if (lesson.lesson_type === 'quiz') {
            const missingStudy = modList.find(
                (l: any) => (l.lesson_type === 'video' || l.lesson_type === 'reading') && !completedSet.has(l.id),
            );
            if (missingStudy) {
                return {
                    allowed: false,
                    reason: 'prerequisite_locked',
                    prerequisiteLessonId: missingStudy.id,
                    prerequisiteLessonSlug: missingStudy.slug,
                    prerequisiteTitle: missingStudy.title,
                    lesson,
                    module: mod,
                };
            }
        } else if (lesson.lesson_type === 'project') {
            const missingBeforeProject = modList.find(
                (l: any) =>
                    (l.lesson_type === 'video' || l.lesson_type === 'reading' || l.lesson_type === 'quiz') &&
                    !completedSet.has(l.id),
            );
            if (missingBeforeProject) {
                return {
                    allowed: false,
                    reason: 'prerequisite_locked',
                    prerequisiteLessonId: missingBeforeProject.id,
                    prerequisiteLessonSlug: missingBeforeProject.slug,
                    prerequisiteTitle: missingBeforeProject.title,
                    lesson,
                    module: mod,
                };
            }
        }
    }

    return { allowed: true, lesson, module: mod, unlocksAt: drip.unlocksAt };
}

export function getTodayWatIso(now = new Date()): string {
    // West Africa Time (UTC+1, no DST) so Nigerian learners roll over at local midnight
    return new Date(now.getTime() + 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Computes the learner's live streak without showing stale numbers after missed days.
 * A streak stays active if the learner completed something today or yesterday (WAT);
 * if more than 1 calendar day has passed without completion, the live streak is 0.
 */
export function getEffectiveStreak(enrollment: Pick<LmsEnrollment, 'current_streak' | 'last_streak_date'>): number {
    const raw = enrollment.current_streak || 0;
    if (raw <= 0 || !enrollment.last_streak_date) return 0;
    const todayIso = getTodayWatIso();
    const diffDays = Math.round(
        (new Date(`${todayIso}T00:00:00Z`).getTime() - new Date(`${enrollment.last_streak_date}T00:00:00Z`).getTime()) /
            86400000,
    );
    return diffDays <= 1 ? raw : 0;
}

/**
 * Updates learner's daily streak & last_active_at whenever they complete a lesson, pass a quiz, or submit a project.
 */
export async function touchLearnerStreak(enrollment: LmsEnrollment): Promise<{ currentStreak: number; longestStreak: number }> {
    const todayIso = getTodayWatIso();
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
