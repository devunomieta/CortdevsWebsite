import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import {
    evaluateLessonAccess,
    isValidLessonIdentifier,
    isValidUuid,
    mergeWatchedRanges,
    requireLmsMember,
    sanitizePlainText,
    sanitizeSingleLine,
    sumWatchedRanges,
    WatchedRange,
} from '../../_lib/lmsGate.js';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const member = await requireLmsMember(req, res);
    if (!member) return;

    const { lessonId, watchedRange, maxSecond, lastPosition, scrollPct, dwellDeltaSeconds, notes } = req.body || {};
    if (!isValidLessonIdentifier(lessonId)) return res.status(400).json({ error: 'Valid lessonId or slug required' });

    const rawIdentifier = String(lessonId).trim();
    let cleanLessonId = rawIdentifier;
    if (!isValidUuid(lessonId as unknown)) {
        const { data: resolved } = await supabase
            .from('lms_lessons')
            .select('id')
            .eq('slug', rawIdentifier.toLowerCase())
            .maybeSingle();
        if (!resolved?.id) return res.status(404).json({ error: 'Lesson not found' });
        cleanLessonId = resolved.id;
    }

    // Fast path for free-tier efficiency:
    // If an in_progress/completed row already exists for this user + lesson,
    // dual-lock access was already verified when the lesson was opened — skip
    // the 4-query evaluateLessonAccess() chain and only fetch 3 tiny metadata columns!
    const { data: existing } = await supabase
        .from('lms_lesson_progress')
        .select('id, status, watched_ranges_json, unique_watched_seconds, max_watched_second, last_position_seconds, scroll_depth_pct, active_dwell_seconds, key_takeaway, notes_json, completed_at')
        .eq('cohort_id', member.cohort.id)
        .eq('user_id', member.enrollment.user_id)
        .eq('lesson_id', cleanLessonId)
        .maybeSingle();

    let lessonMeta: { lesson_type: string; duration_seconds: number; min_dwell_seconds: number } | null = null;

    if (existing) {
        const { data: lm } = await supabase
            .from('lms_lessons')
            .select('lesson_type, duration_seconds, min_dwell_seconds')
            .eq('id', cleanLessonId)
            .maybeSingle();
        lessonMeta = lm;
    } else {
        const access = await evaluateLessonAccess({
            cohort: member.cohort,
            enrollment: member.enrollment,
            lessonId: cleanLessonId,
            includeContent: false,
        });
        if (!access.allowed) {
            return res.status(403).json({ error: 'Lesson locked', reason: access.reason });
        }
        lessonMeta = access.lesson;
    }

    if (!lessonMeta) {
        return res.status(404).json({ error: 'Lesson not found' });
    }

    const prevRanges: WatchedRange[] = Array.isArray(existing?.watched_ranges_json) ? existing.watched_ranges_json : [];
    let nextRanges = prevRanges;

    // Anti-cheat guard: cap any single heartbeat interval to max 90 seconds (30s heartbeat + 1.75x speed headroom)
    if (Array.isArray(watchedRange) && watchedRange.length === 2) {
        const s = Math.max(0, Number(watchedRange[0]) || 0);
        const e = Math.max(s, Number(watchedRange[1]) || s);
        if (e - s > 0 && e - s <= 95) {
            nextRanges = mergeWatchedRanges([...prevRanges, [s, e]]);
        }
    }

    const uniqueWatched = sumWatchedRanges(nextRanges);
    const nextMaxSecond = Math.max(existing?.max_watched_second || 0, Math.floor(Number(maxSecond) || 0), uniqueWatched);
    const nextScroll = Math.max(existing?.scroll_depth_pct || 0, Math.min(100, Math.floor(Number(scrollPct) || 0)));
    const clampedDwellDelta = Math.max(0, Math.min(90, Math.floor(Number(dwellDeltaSeconds) || 0)));
    const nextDwell = (existing?.active_dwell_seconds || 0) + clampedDwellDelta;

    let nextNotes = Array.isArray(existing?.notes_json) ? existing.notes_json : [];
    if (Array.isArray(notes)) {
        nextNotes = notes
            .slice(0, 30)
            .map((n: any, idx: number) => ({
                id: sanitizeSingleLine(n?.id, 48) || `note-${Date.now()}-${idx}`,
                timeSeconds: Math.max(0, Math.floor(Number(n?.timeSeconds) || 0)),
                text: sanitizePlainText(n?.text, 500),
                createdAt: typeof n?.createdAt === 'string' ? n.createdAt.slice(0, 40) : new Date().toISOString(),
            }))
            .filter((n) => n.text.length > 0);
    }

    const { data: updated, error } = await supabase
        .from('lms_lesson_progress')
        .upsert(
            {
                cohort_id: member.cohort.id,
                user_id: member.enrollment.user_id,
                lesson_id: cleanLessonId,
                status: existing?.status === 'completed' ? 'completed' : 'in_progress',
                watched_ranges_json: nextRanges,
                unique_watched_seconds: uniqueWatched,
                max_watched_second: nextMaxSecond,
                last_position_seconds: Math.max(0, Math.floor(Number(lastPosition) || existing?.last_position_seconds || 0)),
                scroll_depth_pct: nextScroll,
                active_dwell_seconds: nextDwell,
                key_takeaway: existing?.key_takeaway || null,
                notes_json: nextNotes,
                completed_at: existing?.completed_at || null,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'cohort_id,user_id,lesson_id' },
        )
        .select('id, status, unique_watched_seconds, max_watched_second, last_position_seconds, scroll_depth_pct, active_dwell_seconds')
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // Only write last_active_at to lms_enrollments if >5 minutes stale (cuts DB writes by ~90%)
    const lastActiveMs = member.enrollment.last_active_at ? new Date(member.enrollment.last_active_at).getTime() : 0;
    if (Date.now() - lastActiveMs > FIVE_MINUTES_MS) {
        await supabase
            .from('lms_enrollments')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', member.enrollment.id);
    }

    const dur = lessonMeta.duration_seconds || 0;
    const watchPct = dur > 0 ? Math.min(100, Math.round((uniqueWatched / dur) * 100)) : 0;

    return res.status(200).json({
        progress: updated,
        watchPct,
        readyToComplete:
            lessonMeta.lesson_type === 'video'
                ? watchPct >= 90
                : nextScroll >= 85 && nextDwell >= (lessonMeta.min_dwell_seconds || 30),
    });
}
