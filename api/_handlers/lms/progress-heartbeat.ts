import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import {
    evaluateLessonAccess,
    mergeWatchedRanges,
    requireLmsMember,
    sumWatchedRanges,
    WatchedRange,
} from '../../_lib/lmsGate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const member = await requireLmsMember(req, res);
    if (!member) return;

    const { lessonId, watchedRange, maxSecond, lastPosition, scrollPct, dwellDeltaSeconds } = req.body || {};
    if (!lessonId) return res.status(400).json({ error: 'lessonId required' });

    const access = await evaluateLessonAccess({
        cohort: member.cohort,
        enrollment: member.enrollment,
        lessonId: String(lessonId),
    });
    if (!access.allowed) {
        return res.status(403).json({ error: 'Lesson locked', reason: access.reason });
    }

    const { data: existing } = await supabase
        .from('lms_lesson_progress')
        .select('*')
        .eq('cohort_id', member.cohort.id)
        .eq('user_id', member.enrollment.user_id)
        .eq('lesson_id', lessonId)
        .maybeSingle();

    const prevRanges: WatchedRange[] = Array.isArray(existing?.watched_ranges_json) ? existing.watched_ranges_json : [];
    let nextRanges = prevRanges;

    // Anti-cheat guard: cap any single heartbeat interval to max 30 seconds of playback
    if (Array.isArray(watchedRange) && watchedRange.length === 2) {
        const s = Math.max(0, Number(watchedRange[0]) || 0);
        const e = Math.max(s, Number(watchedRange[1]) || s);
        if (e - s > 0 && e - s <= 35) {
            nextRanges = mergeWatchedRanges([...prevRanges, [s, e]]);
        }
    }

    const uniqueWatched = sumWatchedRanges(nextRanges);
    const nextMaxSecond = Math.max(existing?.max_watched_second || 0, Math.floor(Number(maxSecond) || 0), uniqueWatched);
    const nextScroll = Math.max(existing?.scroll_depth_pct || 0, Math.min(100, Math.floor(Number(scrollPct) || 0)));
    const clampedDwellDelta = Math.max(0, Math.min(30, Math.floor(Number(dwellDeltaSeconds) || 0)));
    const nextDwell = (existing?.active_dwell_seconds || 0) + clampedDwellDelta;

    const { data: updated, error } = await supabase
        .from('lms_lesson_progress')
        .upsert(
            {
                cohort_id: member.cohort.id,
                user_id: member.enrollment.user_id,
                lesson_id: lessonId,
                status: existing?.status === 'completed' ? 'completed' : 'in_progress',
                watched_ranges_json: nextRanges,
                unique_watched_seconds: uniqueWatched,
                max_watched_second: nextMaxSecond,
                last_position_seconds: Math.max(0, Math.floor(Number(lastPosition) || existing?.last_position_seconds || 0)),
                scroll_depth_pct: nextScroll,
                active_dwell_seconds: nextDwell,
                key_takeaway: existing?.key_takeaway || null,
                completed_at: existing?.completed_at || null,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'cohort_id,user_id,lesson_id' },
        )
        .select('*')
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // Touch last_active_at
    await supabase
        .from('lms_enrollments')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', member.enrollment.id);

    const dur = access.lesson?.duration_seconds || 0;
    const watchPct = dur > 0 ? Math.min(100, Math.round((uniqueWatched / dur) * 100)) : 0;

    return res.status(200).json({
        progress: updated,
        watchPct,
        readyToComplete:
            access.lesson?.lesson_type === 'video'
                ? watchPct >= 90
                : nextScroll >= 85 && nextDwell >= (access.lesson?.min_dwell_seconds || 30),
    });
}
