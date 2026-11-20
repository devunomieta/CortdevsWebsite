import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    BookOpen,
    CalendarClock,
    CheckCircle2,
    Clock,
    Download,
    ExternalLink,
    FileQuestion,
    FolderKanban,
    Loader2,
    Lock,
    MessageSquare,
    PlayCircle,
    Send,
    UploadCloud,
} from 'lucide-react';
import { formatDuration, learnApi } from '../lib/api';
import { useLearnAuth } from '../context/LearnAuthContext';

export function LessonPlayer() {
    const { lessonId } = useParams();
    const navigate = useNavigate();
    const { isAdmin, refreshProfile } = useLearnAuth();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any | null>(null);
    const [lockedInfo, setLockedInfo] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Video state
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const segmentStartRef = useRef<number>(0);
    const [maxWatchedSec, setMaxWatchedSec] = useState(0);
    const [uniqueWatchedSec, setUniqueWatchedSec] = useState(0);
    const [seekWarning, setSeekWarning] = useState(false);

    // Reading state
    const readingContainerRef = useRef<HTMLDivElement | null>(null);
    const [scrollPct, setScrollPct] = useState(0);
    const [dwellSec, setDwellSec] = useState(0);
    const [takeaway, setTakeaway] = useState('');

    // Quiz state
    const [quizAnswers, setQuizAnswers] = useState<Record<string, number[]>>({});
    const [quizResult, setQuizResult] = useState<any | null>(null);
    const [submittingQuiz, setSubmittingQuiz] = useState(false);

    // Project state
    const [projectFile, setProjectFile] = useState<File | null>(null);
    const [externalUrl, setExternalUrl] = useState('');
    const [reflection, setReflection] = useState('');
    const [submittingProject, setSubmittingProject] = useState(false);

    // Completion & Discussion state
    const [completing, setCompleting] = useState(false);
    const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [postingComment, setPostingComment] = useState(false);

    const loadLesson = async () => {
        if (!lessonId) return;
        setLoading(true);
        setError(null);
        setLockedInfo(null);
        setActionMsg(null);
        setQuizResult(null);
        setQuizAnswers({});

        try {
            const res = await learnApi(`lms/lesson?id=${encodeURIComponent(lessonId)}`);
            setData(res);
            setMaxWatchedSec(res.progress?.max_watched_second || 0);
            setUniqueWatchedSec(res.progress?.unique_watched_seconds || 0);
            setScrollPct(res.progress?.scroll_depth_pct || 0);
            setDwellSec(res.progress?.active_dwell_seconds || 0);
            setTakeaway(res.progress?.key_takeaway || '');
            setExternalUrl(res.projectSubmission?.external_url || '');
            setReflection(res.projectSubmission?.reflection_notes || '');

            if (res.lesson?.module_id) {
                learnApi(`lms/discussions?moduleId=${encodeURIComponent(res.lesson.module_id)}`)
                    .then((d) => setComments(d.comments || []))
                    .catch(() => {});
            }
        } catch (err: any) {
            if (err.status === 403 && err.payload) {
                setLockedInfo(err.payload);
            } else {
                setError(err?.message || 'Unable to load lesson');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLesson();
    }, [lessonId]);

    // Video 10-second heartbeat + anti-skip enforcement
    useEffect(() => {
        if (!data || data.lesson?.lesson_type !== 'video') return;
        const vid = videoRef.current;
        if (!vid) return;

        // Resume last saved position
        if (data.progress?.last_position_seconds > 5) {
            vid.currentTime = data.progress.last_position_seconds;
            segmentStartRef.current = data.progress.last_position_seconds;
        }

        const interval = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.paused || document.visibilityState !== 'visible') return;
            const cur = Math.floor(videoRef.current.currentTime);
            const start = Math.floor(segmentStartRef.current);
            if (cur > start && cur - start <= 30) {
                segmentStartRef.current = cur;
                try {
                    const hb = await learnApi('lms/progress-heartbeat', {
                        method: 'POST',
                        body: {
                            lessonId: data.lesson.id,
                            watchedRange: [start, cur],
                            maxSecond: Math.max(maxWatchedSec, cur),
                            lastPosition: cur,
                        },
                    });
                    setUniqueWatchedSec(hb.progress?.unique_watched_seconds || 0);
                    setMaxWatchedSec(hb.progress?.max_watched_second || cur);
                } catch {
                    // ignore transient network glitches
                }
            } else {
                segmentStartRef.current = cur;
            }
        }, 10000);

        return () => window.clearInterval(interval);
    }, [data?.lesson?.id]);

    // Reading active dwell timer (10s heartbeats while tab is visible) + scroll tracking
    useEffect(() => {
        if (!data || data.lesson?.lesson_type !== 'reading') return;
        let pendingDelta = 0;

        const handleScroll = () => {
            const docEl = document.documentElement;
            const total = docEl.scrollHeight - docEl.clientHeight;
            const pct = total <= 10 ? 100 : Math.min(100, Math.round((window.scrollY / total) * 100));
            setScrollPct((prev) => Math.max(prev, pct));
        };
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });

        const tick = window.setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            pendingDelta += 1;
            setDwellSec((prev) => prev + 1);

            if (pendingDelta >= 10) {
                const toSend = pendingDelta;
                pendingDelta = 0;
                const docEl = document.documentElement;
                const total = docEl.scrollHeight - docEl.clientHeight;
                const curScroll = total <= 10 ? 100 : Math.min(100, Math.round((window.scrollY / total) * 100));
                learnApi('lms/progress-heartbeat', {
                    method: 'POST',
                    body: {
                        lessonId: data.lesson.id,
                        scrollPct: curScroll,
                        dwellDeltaSeconds: toSend,
                    },
                }).catch(() => {});
            }
        }, 1000);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.clearInterval(tick);
        };
    }, [data?.lesson?.id]);

    const handleVideoSeeking = () => {
        const vid = videoRef.current;
        if (!vid || isAdmin || data?.progress?.status === 'completed') return;
        if (vid.currentTime > maxWatchedSec + 15) {
            vid.currentTime = maxWatchedSec;
            setSeekWarning(true);
            window.setTimeout(() => setSeekWarning(false), 3500);
        } else {
            segmentStartRef.current = vid.currentTime;
        }
    };

    const handleVideoRateChange = () => {
        const vid = videoRef.current;
        if (!vid || isAdmin) return;
        if (vid.playbackRate > 1.75) {
            vid.playbackRate = 1.75;
        }
    };

    const handleCompleteVideoOrReading = async () => {
        if (!data) return;
        setCompleting(true);
        setActionMsg(null);
        try {
            // Flush final reading scroll/dwell before completing
            if (data.lesson.lesson_type === 'reading') {
                await learnApi('lms/progress-heartbeat', {
                    method: 'POST',
                    body: { lessonId: data.lesson.id, scrollPct: Math.max(scrollPct, 90), dwellDeltaSeconds: 5 },
                }).catch(() => {});
            }
            const res = await learnApi('lms/progress-complete', {
                method: 'POST',
                body: {
                    lessonId: data.lesson.id,
                    keyTakeaway: takeaway.trim() || undefined,
                },
            });
            setData((prev: any) => ({ ...prev, progress: res.progress }));
            await refreshProfile();
            setActionMsg({ type: 'success', text: 'Lesson completed! Your next lesson is now unlocked.' });
        } catch (err: any) {
            setActionMsg({ type: 'error', text: err?.message || 'Could not complete lesson yet.' });
        } finally {
            setCompleting(false);
        }
    };

    const toggleQuizOption = (qId: string, optIdx: number, type: 'single' | 'multi') => {
        setQuizAnswers((prev) => {
            const existing = prev[qId] || [];
            if (type === 'single') return { ...prev, [qId]: [optIdx] };
            const exists = existing.includes(optIdx);
            return {
                ...prev,
                [qId]: exists ? existing.filter((i) => i !== optIdx) : [...existing, optIdx],
            };
        });
    };

    const handleSubmitQuiz = async () => {
        if (!data) return;
        setSubmittingQuiz(true);
        setActionMsg(null);
        try {
            const res = await learnApi('lms/quiz-submit', {
                method: 'POST',
                body: { lessonId: data.lesson.id, answers: quizAnswers },
            });
            setQuizResult(res);
            if (res.passed) {
                setData((prev: any) => ({
                    ...prev,
                    progress: { ...prev.progress, status: 'completed' },
                }));
                await refreshProfile();
            }
        } catch (err: any) {
            setActionMsg({ type: 'error', text: err?.message || 'Quiz submission failed.' });
        } finally {
            setSubmittingQuiz(false);
        }
    };

    const handleSubmitProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!data) return;
        setSubmittingProject(true);
        setActionMsg(null);
        try {
            let fileStoragePath: string | undefined;
            let fileName: string | undefined;

            if (projectFile) {
                const up = await learnApi('lms/project-submit', {
                    method: 'POST',
                    body: {
                        action: 'upload_url',
                        lessonId: data.lesson.id,
                        fileName: projectFile.name,
                    },
                });
                const putRes = await fetch(up.uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': projectFile.type || 'application/octet-stream' },
                    body: projectFile,
                });
                if (!putRes.ok) throw new Error('File upload failed. Please retry.');
                fileStoragePath = up.storagePath;
                fileName = projectFile.name;
            }

            const res = await learnApi('lms/project-submit', {
                method: 'POST',
                body: {
                    action: 'submit',
                    lessonId: data.lesson.id,
                    fileStoragePath: fileStoragePath || data.projectSubmission?.file_storage_path,
                    fileName: fileName || data.projectSubmission?.file_name,
                    externalUrl: externalUrl.trim() || undefined,
                    reflectionNotes: reflection.trim(),
                },
            });

            setData((prev: any) => ({
                ...prev,
                projectSubmission: res.submission,
                progress: { ...prev.progress, status: res.autoUnlocked ? 'completed' : prev.progress?.status },
            }));
            setProjectFile(null);
            await refreshProfile();
            setActionMsg({
                type: 'success',
                text: 'Deliverable submitted! Your next module is immediately unlocked while your team lead & peer buddy review asynchronously.',
            });
        } catch (err: any) {
            setActionMsg({ type: 'error', text: err?.message || 'Project submission failed.' });
        } finally {
            setSubmittingProject(false);
        }
    };

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!data?.lesson?.module_id || !newComment.trim()) return;
        setPostingComment(true);
        try {
            const res = await learnApi('lms/discussions', {
                method: 'POST',
                body: { moduleId: data.lesson.module_id, body: newComment.trim() },
            });
            setComments((prev) => [...prev, res.comment]);
            setNewComment('');
        } catch {
            // ignore
        } finally {
            setPostingComment(false);
        }
    };

    if (loading) {
        return (
            <div className="py-20 flex items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                <span className="text-sm">Unlocking lesson content...</span>
            </div>
        );
    }

    if (lockedInfo) {
        const isDrip = lockedInfo.reason === 'drip_locked';
        return (
            <div className="max-w-xl mx-auto py-12 text-center space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
                    {isDrip ? <CalendarClock className="w-8 h-8 text-amber-400" /> : <Lock className="w-8 h-8 text-amber-400" />}
                </div>
                <h1 className="text-2xl font-bold text-white">
                    {isDrip ? 'Waiting for Weekly Monday Drip' : 'Sequential Prerequisite Locked'}
                </h1>
                <p className="text-sm text-slate-300">{lockedInfo.error}</p>
                {isDrip && lockedInfo.unlocksAt && (
                    <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 inline-block px-4 py-2 rounded-full">
                        Unlocks: {new Date(lockedInfo.unlocksAt).toLocaleString()}
                    </p>
                )}
                <div className="flex items-center justify-center gap-3 pt-2">
                    <Link
                        to="/dashboard"
                        className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-white"
                    >
                        Back to Roadmap
                    </Link>
                    {lockedInfo.prerequisiteLessonId && (
                        <Link
                            to={`/lesson/${lockedInfo.prerequisiteLessonId}`}
                            className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white"
                        >
                            Go to: {lockedInfo.prerequisiteTitle || 'Previous Lesson'}
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-200 text-sm">
                {error || 'Lesson unavailable.'}
            </div>
        );
    }

    const { lesson, progress, navigation, projectSubmission } = data;
    const isCompleted = progress?.status === 'completed';
    const watchPct =
        lesson.duration_seconds > 0
            ? Math.min(100, Math.round((uniqueWatchedSec / lesson.duration_seconds) * 100))
            : 0;

    return (
        <div className="space-y-6">
            {/* Top Breadcrumb + Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Roadmap
                    </Link>
                    <div className="text-xs text-slate-400">
                        {lesson.course_title} · {lesson.module_title} · Week {lesson.target_week}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
                        {lesson.title}
                        {isCompleted && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                            </span>
                        )}
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    {navigation.prev && (
                        <button
                            onClick={() => navigate(`/lesson/${navigation.prev.id}`)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-medium text-slate-300"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Prev
                        </button>
                    )}
                    {navigation.next && (
                        <button
                            disabled={!isCompleted && !isAdmin}
                            onClick={() => navigate(`/lesson/${navigation.next.id}`)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white"
                        >
                            Next Lesson <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {actionMsg && (
                <div
                    className={`rounded-xl px-4 py-3 text-sm border flex items-center justify-between gap-4 ${
                        actionMsg.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                            : 'bg-red-500/10 border-red-500/30 text-red-200'
                    }`}
                >
                    <span>{actionMsg.text}</span>
                    {actionMsg.type === 'success' && navigation.next && (
                        <button
                            onClick={() => navigate(`/lesson/${navigation.next.id}`)}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                        >
                            Next Lesson →
                        </button>
                    )}
                </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6 items-start">
                {/* Main Lesson Pane */}
                <div className="lg:col-span-2 space-y-6">
                    {/* 1. VIDEO LESSON */}
                    {lesson.lesson_type === 'video' && (
                        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                            {lesson.video_signed_url ? (
                                <div className="relative bg-black">
                                    <video
                                        ref={videoRef}
                                        src={lesson.video_signed_url}
                                        controls
                                        controlsList="nodownload"
                                        playsInline
                                        onSeeking={handleVideoSeeking}
                                        onRateChange={handleVideoRateChange}
                                        onPlay={() => {
                                            if (videoRef.current) segmentStartRef.current = videoRef.current.currentTime;
                                        }}
                                        className="w-full aspect-video"
                                    />
                                    {seekWarning && (
                                        <div className="absolute top-4 right-4 bg-amber-500 text-slate-950 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Forward skipping is disabled until watched
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="aspect-video bg-slate-950 flex flex-col items-center justify-center p-8 text-center space-y-3">
                                    <PlayCircle className="w-12 h-12 text-slate-600" />
                                    <p className="text-sm font-medium text-slate-300">
                                        {lesson.r2_configured
                                            ? 'Video object not uploaded to R2 yet.'
                                            : 'Cloudflare R2 credentials not configured in .env yet.'}
                                    </p>
                                    <p className="text-xs text-slate-500 max-w-md">
                                        Run <code className="text-indigo-300">npx tsx scripts/ingest-ai-pm-course.ts --slice-videos --upload-r2</code> after adding your Cloudflare R2 keys.
                                    </p>
                                </div>
                            )}

                            {/* Video Telemetry & Completion Bar */}
                            <div className="p-5 space-y-4 border-t border-slate-800">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="text-xs font-semibold text-slate-300">
                                            Verified Watch Progress: <span className="text-indigo-300">{watchPct}%</span> (≥90% required to unlock next)
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            Unique watched: {formatDuration(uniqueWatchedSec)} / {formatDuration(lesson.duration_seconds)} · Max speed 1.75x
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCompleteVideoOrReading}
                                        disabled={completing || (!isAdmin && watchPct < 90)}
                                        className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold inline-flex items-center gap-2 transition"
                                    >
                                        {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        {isCompleted ? 'Completed' : 'Mark Video Complete'}
                                    </button>
                                </div>

                                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-300 ${watchPct >= 90 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                        style={{ width: `${watchPct}%` }}
                                    />
                                </div>

                                {/* Clickable Chapter Markers from .txt */}
                                {Array.isArray(lesson.chapters) && lesson.chapters.length > 0 && (
                                    <div className="pt-2">
                                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                            Lesson Chapters ({lesson.chapters.length})
                                        </div>
                                        <div className="grid sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                                            {lesson.chapters.map((ch: any, idx: number) => {
                                                const canJump = isAdmin || isCompleted || ch.startSeconds <= maxWatchedSec + 15;
                                                return (
                                                    <button
                                                        key={idx}
                                                        disabled={!canJump}
                                                        onClick={() => {
                                                            if (videoRef.current) {
                                                                videoRef.current.currentTime = ch.startSeconds;
                                                                segmentStartRef.current = ch.startSeconds;
                                                                videoRef.current.play().catch(() => {});
                                                            }
                                                        }}
                                                        className={`text-left px-3 py-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition ${
                                                            canJump
                                                                ? 'bg-slate-950/70 border-slate-800 hover:border-indigo-500/40 text-slate-200'
                                                                : 'bg-slate-950/30 border-slate-800/50 text-slate-600 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        <span className="truncate">{ch.title}</span>
                                                        <span className="font-mono text-[10px] text-slate-500 shrink-0">
                                                            {formatDuration(ch.startSeconds)}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 2. READING LESSON */}
                    {lesson.lesson_type === 'reading' && (
                        <div ref={readingContainerRef} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                            <div className="px-6 py-3.5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                                <span className="inline-flex items-center gap-1.5">
                                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                                    {lesson.word_count?.toLocaleString() || 0} words · Est. {lesson.estimated_minutes} min
                                </span>
                                <span className="inline-flex items-center gap-3">
                                    <span>Scroll: <strong className="text-slate-200">{scrollPct}%</strong> (≥85%)</span>
                                    <span className="inline-flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        Dwell: <strong className="text-slate-200">{dwellSec}s</strong> / {lesson.min_dwell_seconds}s
                                    </span>
                                </span>
                            </div>

                            <article
                                className="p-6 sm:p-8 prose prose-invert prose-slate max-w-none prose-headings:text-white prose-p:text-slate-200 prose-p:leading-relaxed prose-li:text-slate-200 prose-strong:text-white"
                                dangerouslySetInnerHTML={{ __html: lesson.content_html || '<p>No reading content found.</p>' }}
                            />

                            {/* Mandatory 1-Sentence Key Takeaway Gate */}
                            <div className="p-6 bg-slate-950/70 border-t border-slate-800 space-y-3">
                                <label className="block text-sm font-semibold text-white">
                                    Key Takeaway (Required to unlock next lesson)
                                </label>
                                <p className="text-xs text-slate-400">
                                    Summarize one actionable insight from this reading in 1–2 sentences (min 30 chars). This shares to your team's Cohort Takeaways Feed.
                                </p>
                                <textarea
                                    rows={3}
                                    value={takeaway}
                                    onChange={(e) => setTakeaway(e.target.value)}
                                    placeholder="My biggest takeaway from this reading is..."
                                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <span className="text-xs text-slate-500">{takeaway.trim().length} / 30 min characters</span>
                                    <button
                                        onClick={handleCompleteVideoOrReading}
                                        disabled={completing}
                                        className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-2 transition"
                                    >
                                        {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        {isCompleted ? 'Update Takeaway' : 'Save Takeaway & Complete Reading'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. PRACTICE QUIZ */}
                    {lesson.lesson_type === 'quiz' && (
                        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800">
                                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                    <FileQuestion className="w-5 h-5 text-amber-400" />
                                    <span>
                                        {lesson.quiz_questions?.length || 0} Questions · Pass Score ≥ {lesson.pass_threshold_pct || 80}%
                                    </span>
                                </div>
                                {!lesson.quiz_keys_verified && (
                                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                        Completion-Verified (Answer key pending admin lock)
                                    </span>
                                )}
                            </div>

                            {quizResult && (
                                <div
                                    className={`p-4 rounded-xl border text-sm ${
                                        quizResult.passed
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                                            : 'bg-red-500/10 border-red-500/30 text-red-200'
                                    }`}
                                >
                                    <div className="font-semibold">
                                        {quizResult.passed ? 'Passed!' : 'Not quite yet — try again!'} Score: {quizResult.scorePct}% (
                                        {quizResult.correctCount}/{quizResult.totalQuestions} correct)
                                    </div>
                                    {quizResult.passed && navigation.next && (
                                        <button
                                            onClick={() => navigate(`/lesson/${navigation.next.id}`)}
                                            className="mt-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                                        >
                                            Continue to Next Lesson →
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="space-y-6">
                                {(lesson.quiz_questions || []).map((q: any, qIdx: number) => {
                                    const picked = quizAnswers[q.id] || [];
                                    const qRes = quizResult?.breakdown?.find((b: any) => b.id === q.id);

                                    return (
                                        <div key={q.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="text-sm font-medium text-white leading-relaxed">
                                                    <span className="text-indigo-400 font-bold mr-1.5">Q{qIdx + 1}.</span>
                                                    {q.prompt}
                                                </p>
                                                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                                                    {q.type === 'multi' ? 'Multi-Select' : 'Single Choice'}
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                {q.options.map((opt: string, optIdx: number) => {
                                                    const checked = picked.includes(optIdx);
                                                    return (
                                                        <label
                                                            key={optIdx}
                                                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer text-sm transition ${
                                                                checked
                                                                    ? 'bg-indigo-500/15 border-indigo-500/50 text-white'
                                                                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                                            }`}
                                                        >
                                                            <input
                                                                type={q.type === 'multi' ? 'checkbox' : 'radio'}
                                                                name={q.id}
                                                                checked={checked}
                                                                onChange={() => toggleQuizOption(q.id, optIdx, q.type)}
                                                                className="mt-0.5 accent-indigo-500"
                                                            />
                                                            <span>{opt}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>

                                            {qRes && (
                                                <div className={`text-xs pt-1 ${qRes.correct ? 'text-emerald-400' : 'text-amber-300'}`}>
                                                    {qRes.correct ? '✓ Correct' : '✗ Review this question and retry.'}{' '}
                                                    {qRes.explanation && <span className="text-slate-400">— {qRes.explanation}</span>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={handleSubmitQuiz}
                                disabled={submittingQuiz}
                                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
                            >
                                {submittingQuiz ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Quiz Answers'}
                            </button>
                        </div>
                    )}

                    {/* 4. HANDS-ON PROJECT DELIVERABLE */}
                    {lesson.lesson_type === 'project' && (
                        <div className="space-y-5">
                            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
                                <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                                    <FolderKanban className="w-5 h-5" />
                                    <span>Hands-On Portfolio Deliverable · Auto-Unlocks Next Module on Upload</span>
                                </div>
                                {lesson.project_brief && (
                                    <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                                        {lesson.project_brief}
                                    </p>
                                )}

                                {lesson.project_assets?.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                            Download Project Templates & Scenario Files
                                        </div>
                                        <div className="grid sm:grid-cols-2 gap-2">
                                            {lesson.project_assets.map((asset: any, idx: number) => (
                                                <a
                                                    key={idx}
                                                    href={asset.downloadUrl || '#'}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 text-xs text-slate-200 transition"
                                                >
                                                    <span className="truncate">{asset.name}</span>
                                                    <Download className="w-4 h-4 text-indigo-400 shrink-0" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Existing Review Feedback Banner */}
                            {projectSubmission && (
                                <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-white">Your Current Submission</span>
                                        <span
                                            className={`px-2.5 py-0.5 rounded-full font-semibold capitalize ${
                                                projectSubmission.review_status === 'approved'
                                                    ? 'bg-emerald-500/20 text-emerald-300'
                                                    : projectSubmission.review_status === 'revision_requested'
                                                      ? 'bg-amber-500/20 text-amber-300'
                                                      : 'bg-sky-500/20 text-sky-300'
                                            }`}
                                        >
                                            {projectSubmission.review_status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    {projectSubmission.file_name && (
                                        <div className="text-xs text-slate-400">Uploaded file: {projectSubmission.file_name}</div>
                                    )}
                                    {projectSubmission.external_url && (
                                        <a
                                            href={projectSubmission.external_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline"
                                        >
                                            {projectSubmission.external_url} <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                    {projectSubmission.reviewer_feedback && (
                                        <div className="mt-2 p-3 rounded-lg bg-slate-950 border-l-2 border-indigo-500 text-xs text-slate-200">
                                            <strong>Reviewer Feedback:</strong> {projectSubmission.reviewer_feedback}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Upload Form */}
                            <form
                                onSubmit={handleSubmitProject}
                                className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4"
                            >
                                <h3 className="text-sm font-semibold text-white">
                                    {projectSubmission ? 'Update / Resubmit Deliverable' : 'Submit Your Deliverable'}
                                </h3>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-300">
                                        Upload File (.docx, .xlsx, .pdf, .pptx, .png)
                                    </label>
                                    <label className="flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 hover:border-indigo-500/50 cursor-pointer text-xs text-slate-300">
                                        <UploadCloud className="w-4 h-4 text-indigo-400" />
                                        <span>{projectFile ? projectFile.name : 'Click to attach completed deliverable file'}</span>
                                        <input
                                            type="file"
                                            className="hidden"
                                            onChange={(e) => setProjectFile(e.target.files?.[0] || null)}
                                        />
                                    </label>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-300">
                                        Or Share Link (Figma / Power BI / Google Doc / Notion)
                                    </label>
                                    <input
                                        type="url"
                                        value={externalUrl}
                                        onChange={(e) => setExternalUrl(e.target.value)}
                                        placeholder="https://figma.com/file/..."
                                        className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-300">
                                        Implementation Reflection (min 40 chars)
                                    </label>
                                    <textarea
                                        rows={4}
                                        required
                                        minLength={40}
                                        value={reflection}
                                        onChange={(e) => setReflection(e.target.value)}
                                        placeholder="Summarize the key decisions you made and how you could apply this framework to a real CortDevs product..."
                                        className="w-full rounded-lg bg-slate-950 border border-slate-800 p-3 text-sm text-white"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submittingProject}
                                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
                                >
                                    {submittingProject ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        'Submit Deliverable & Unlock Next Module'
                                    )}
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                {/* Right Sidebar: Module Team Discussion & Q&A */}
                <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <MessageSquare className="w-4 h-4 text-indigo-400" />
                        <span>Module Team Discussion</span>
                    </div>

                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                        {comments.length === 0 ? (
                            <p className="text-xs text-slate-500 py-4 text-center">
                                Ask a question or share an insight with your teammates on this module.
                            </p>
                        ) : (
                            comments.map((c) => (
                                <div key={c.id} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-semibold text-indigo-300">
                                            {c.author_name}
                                            {c.author_role === 'admin' && (
                                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                                                    Lead
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-slate-500">{new Date(c.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs text-slate-200 whitespace-pre-wrap">{c.body}</p>
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={handlePostComment} className="flex gap-2 pt-2 border-t border-slate-800">
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Post a note or question..."
                            className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button
                            type="submit"
                            disabled={postingComment || !newComment.trim()}
                            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
