import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { CoursePartnerStrip, CourseraLogo, MicrosoftLogo } from '../components/BrandLogos';
import { sanitizeReadingHtml } from '../lib/sessionTimer';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB cap to protect Supabase Free 1 GB storage
const HEARTBEAT_INTERVAL_MS = 30000; // 30s heartbeat (cuts free-tier API + DB load by ~89%)

export function LessonPlayer() {
    const { lessonId } = useParams();
    const navigate = useNavigate();
    const { isAdmin, refreshProfile } = useLearnAuth();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any | null>(null);
    const [lockedInfo, setLockedInfo] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Video state (refs prevent stale closures in heartbeat & pause/ended handlers)
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const segmentStartRef = useRef<number>(0);
    const maxWatchedRef = useRef<number>(0);
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

    const loadLesson = useCallback(async () => {
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
            const initMax = res.progress?.max_watched_second || 0;
            maxWatchedRef.current = initMax;
            setMaxWatchedSec(initMax);
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
    }, [lessonId]);

    useEffect(() => {
        loadLesson();
    }, [loadLesson]);

    const activeLessonId = data?.lesson?.id as string | undefined;
    const activeLessonType = data?.lesson?.lesson_type as string | undefined;
    const initialLastPosition = (data?.progress?.last_position_seconds as number) || 0;

    const flushVideoHeartbeat = useCallback(
        async (forceLessonId?: string) => {
            const lid = forceLessonId || activeLessonId;
            const vid = videoRef.current;
            if (!lid || !vid) return;
            const cur = Math.floor(vid.currentTime);
            const start = Math.floor(segmentStartRef.current);
            if (cur > start && cur - start <= 90) {
                segmentStartRef.current = cur;
                const nextMax = Math.max(maxWatchedRef.current, cur);
                maxWatchedRef.current = nextMax;
                try {
                    const hb = await learnApi('lms/progress-heartbeat', {
                        method: 'POST',
                        body: {
                            lessonId: lid,
                            watchedRange: [start, cur],
                            maxSecond: nextMax,
                            lastPosition: cur,
                        },
                    });
                    const serverMax = hb.progress?.max_watched_second || nextMax;
                    maxWatchedRef.current = Math.max(maxWatchedRef.current, serverMax);
                    setUniqueWatchedSec(hb.progress?.unique_watched_seconds || 0);
                    setMaxWatchedSec(maxWatchedRef.current);
                } catch {
                    // ignore transient network glitches
                }
            } else {
                segmentStartRef.current = cur;
            }
        },
        [activeLessonId],
    );

    // Video 30-second heartbeat + initial resume position
    useEffect(() => {
        if (!activeLessonId || activeLessonType !== 'video') return;
        const vid = videoRef.current;
        if (vid && initialLastPosition > 5) {
            vid.currentTime = initialLastPosition;
            segmentStartRef.current = initialLastPosition;
        }

        const interval = window.setInterval(() => {
            if (!videoRef.current || videoRef.current.paused || document.visibilityState !== 'visible') return;
            flushVideoHeartbeat(activeLessonId);
        }, HEARTBEAT_INTERVAL_MS);

        return () => window.clearInterval(interval);
    }, [activeLessonId, activeLessonType, initialLastPosition, flushVideoHeartbeat]);

    // Reading active dwell timer (30s heartbeats while tab is visible) + scroll tracking
    useEffect(() => {
        if (!activeLessonId || activeLessonType !== 'reading') return;
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

            if (pendingDelta >= 30) {
                const toSend = pendingDelta;
                pendingDelta = 0;
                const docEl = document.documentElement;
                const total = docEl.scrollHeight - docEl.clientHeight;
                const curScroll = total <= 10 ? 100 : Math.min(100, Math.round((window.scrollY / total) * 100));
                learnApi('lms/progress-heartbeat', {
                    method: 'POST',
                    body: {
                        lessonId: activeLessonId,
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
    }, [activeLessonId, activeLessonType]);

    const safeReadingHtml = useMemo(
        () => sanitizeReadingHtml(data?.lesson?.content_html || '<p>No reading content found.</p>'),
        [data?.lesson?.content_html],
    );

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
                if (projectFile.size > MAX_UPLOAD_BYTES) {
                    throw new Error('File is too large (max 10 MB). Compress the file or paste a Google Drive / Figma link instead.');
                }
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
            <div className="py-20 flex items-center justify-center gap-3 text-neutral-500">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-950" />
                <span className="text-xs uppercase tracking-[0.2em]">Unlocking lesson content...</span>
            </div>
        );
    }

    if (lockedInfo) {
        const isDrip = lockedInfo.reason === 'drip_locked';
        return (
            <div className="max-w-xl mx-auto py-12 text-center space-y-5 bg-white border border-neutral-200 p-8">
                <div className="w-14 h-14 bg-neutral-100 border border-neutral-200 flex items-center justify-center mx-auto">
                    {isDrip ? <CalendarClock className="w-7 h-7 text-neutral-900" /> : <Lock className="w-7 h-7 text-neutral-900" />}
                </div>
                <h1 className="text-2xl font-semibold text-neutral-950">
                    {isDrip ? 'Coming Up Next Monday' : 'Complete the Previous Lesson First'}
                </h1>
                <p className="text-sm text-neutral-600">
                    {isDrip
                        ? 'This week’s lessons unlock on Monday at 7:00 AM WAT so the whole team stays together.'
                        : 'Finish the lesson before this one to unlock it.'}
                </p>
                {isDrip && lockedInfo.unlocksAt && (
                    <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 inline-block px-4 py-2">
                        Unlocks: {new Date(lockedInfo.unlocksAt).toLocaleString()}
                    </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Link
                        to="/dashboard"
                        className="px-5 py-2.5 bg-white border border-neutral-300 hover:border-neutral-950 text-xs font-bold uppercase tracking-[0.16em] text-neutral-900"
                    >
                        Back to Roadmap
                    </Link>
                    {lockedInfo.prerequisiteLessonId && (
                        <Link
                            to={`/lesson/${lockedInfo.prerequisiteLessonId}`}
                            className="px-5 py-2.5 bg-[#030213] hover:bg-neutral-800 text-xs font-bold uppercase tracking-[0.16em] text-white"
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
            <div className="bg-red-50 border border-red-200 p-6 text-red-700 text-sm">
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
            {/* Top Breadcrumb + Co-Branded Partner Strip + Navigation */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-neutral-200">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-neutral-600 hover:text-neutral-950"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Roadmap
                        </Link>
                        <span className="text-neutral-300">/</span>
                        <CoursePartnerStrip compact />
                    </div>
                    <div className="text-xs text-neutral-500">
                        {lesson.course_title} · {lesson.module_title} · Week {lesson.target_week}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-neutral-950 flex flex-wrap items-center gap-2.5">
                        <span>{lesson.title}</span>
                        {isCompleted && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                            </span>
                        )}
                    </h1>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {navigation.prev && (
                        <button
                            onClick={() => navigate(`/lesson/${navigation.prev.id}`)}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white border border-neutral-300 hover:border-neutral-950 text-xs font-bold uppercase tracking-[0.14em] text-neutral-800 transition"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Prev
                        </button>
                    )}
                    {navigation.next && (
                        <button
                            disabled={!isCompleted && !isAdmin}
                            onClick={() => navigate(`/lesson/${navigation.next.id}`)}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#030213] hover:bg-neutral-800 disabled:opacity-35 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-[0.14em] text-white transition"
                        >
                            Next Lesson <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {actionMsg && (
                <div
                    className={`px-4 py-3 text-sm border flex flex-wrap items-center justify-between gap-4 ${
                        actionMsg.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                >
                    <span>{actionMsg.text}</span>
                    {actionMsg.type === 'success' && navigation.next && (
                        <button
                            onClick={() => navigate(`/lesson/${navigation.next.id}`)}
                            className="shrink-0 px-3.5 py-1.5 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.14em]"
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
                        <div className="bg-white border border-neutral-200 overflow-hidden">
                            {/* Video Player Co-Branded Top Strip (Microsoft + Coursera) */}
                            <div className="px-4 py-2.5 bg-[#030213] text-white flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
                                <div className="inline-flex items-center gap-3">
                                    <MicrosoftLogo dark className="h-3.5" />
                                    <span className="text-white/30 text-xs">×</span>
                                    <CourseraLogo dark />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                                    AI Product Manager · Protected Stream
                                </span>
                            </div>

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
                                        onPause={() => {
                                            flushVideoHeartbeat();
                                        }}
                                        onEnded={() => {
                                            flushVideoHeartbeat();
                                        }}
                                        className="w-full aspect-video"
                                    />
                                    {seekWarning && (
                                        <div className="absolute top-4 right-4 bg-amber-400 text-neutral-950 text-xs font-semibold px-3 py-1.5 shadow-lg flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Forward skipping is disabled until watched
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="aspect-video bg-neutral-950 text-white flex flex-col items-center justify-center p-8 text-center space-y-3">
                                    <PlayCircle className="w-12 h-12 text-neutral-500" />
                                    <p className="text-sm font-medium text-neutral-200">
                                        {lesson.r2_configured
                                            ? 'Video object not uploaded to Cloudflare R2 yet.'
                                            : 'Cloudflare R2 credentials not configured in .env yet.'}
                                    </p>
                                    <p className="text-xs text-neutral-400 max-w-md">
                                        Run <code className="text-white">npx tsx scripts/ingest-ai-pm-course.ts --upload-r2</code> after adding your Cloudflare R2 keys.
                                    </p>
                                </div>
                            )}

                            {/* Video Telemetry & Completion Bar */}
                            <div className="p-5 space-y-4 border-t border-neutral-200">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="text-xs font-semibold text-neutral-900">
                                            Video Progress: <span className="font-bold">{watchPct}%</span> (watch at least 90% to unlock next)
                                        </div>
                                        <div className="text-[11px] text-neutral-500">
                                            Watched: {formatDuration(uniqueWatchedSec)} / {formatDuration(lesson.duration_seconds)} · Up to 1.75x speed
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCompleteVideoOrReading}
                                        disabled={completing || (!isAdmin && watchPct < 90)}
                                        className="w-full sm:w-auto px-4 py-2.5 bg-[#030213] hover:bg-neutral-800 disabled:opacity-35 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 transition"
                                    >
                                        {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        {isCompleted ? 'Completed' : 'Mark Video Complete'}
                                    </button>
                                </div>

                                <div className="h-2 w-full bg-neutral-200 overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-300 ${watchPct >= 90 ? 'bg-emerald-600' : 'bg-[#030213]'}`}
                                        style={{ width: `${watchPct}%` }}
                                    />
                                </div>

                                {/* Clickable Chapter Markers from .txt */}
                                {Array.isArray(lesson.chapters) && lesson.chapters.length > 0 && (
                                    <div className="pt-2">
                                        <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.16em] mb-2">
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
                                                        className={`text-left px-3 py-2 border text-xs flex items-center justify-between gap-2 transition ${
                                                            canJump
                                                                ? 'bg-neutral-50 border-neutral-200 hover:border-neutral-950 text-neutral-900'
                                                                : 'bg-neutral-50/50 border-neutral-200/60 text-neutral-400 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        <span className="truncate">{ch.title}</span>
                                                        <span className="font-mono text-[10px] text-neutral-500 shrink-0">
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
                        <div ref={readingContainerRef} className="bg-white border border-neutral-200 overflow-hidden">
                            <div className="px-4 sm:px-6 py-3.5 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
                                <span className="inline-flex items-center gap-1.5 font-medium">
                                    <BookOpen className="w-3.5 h-3.5 text-neutral-900" />
                                    {lesson.word_count?.toLocaleString() || 0} words · About {lesson.estimated_minutes} min read
                                </span>
                                <span className="inline-flex items-center gap-3">
                                    <span>Scrolled: <strong className="text-neutral-950">{scrollPct}%</strong></span>
                                    <span className="inline-flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        Reading Time: <strong className="text-neutral-950">{dwellSec}s</strong> / {lesson.min_dwell_seconds}s
                                    </span>
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <article
                                    className="p-4 sm:p-8 prose prose-sm sm:prose-base prose-neutral max-w-none prose-headings:text-neutral-950 prose-p:text-neutral-800 prose-p:leading-relaxed prose-li:text-neutral-800 prose-strong:text-neutral-950 break-words"
                                    dangerouslySetInnerHTML={{ __html: safeReadingHtml }}
                                />
                            </div>

                            <div className="p-4 sm:p-6 bg-neutral-50 border-t border-neutral-200 space-y-3">
                                <label className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-900">
                                    What Did You Learn? (Required to unlock next lesson)
                                </label>
                                <p className="text-xs text-neutral-500">
                                    Write 1–2 short sentences on one thing you learned from this reading (at least 30 characters). Your teammates can see it in Team Notes.
                                </p>
                                <textarea
                                    rows={3}
                                    value={takeaway}
                                    onChange={(e) => setTakeaway(e.target.value)}
                                    placeholder="One thing I learned from this reading is..."
                                    className="w-full bg-white border border-neutral-300 p-3.5 text-base sm:text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                                />
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <span className="text-xs text-neutral-500">{takeaway.trim().length} / 30 characters minimum</span>
                                    <button
                                        onClick={handleCompleteVideoOrReading}
                                        disabled={completing}
                                        className="w-full sm:w-auto px-5 py-2.5 bg-[#030213] hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-[0.16em] inline-flex items-center justify-center gap-2 transition"
                                    >
                                        {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        {isCompleted ? 'Update Note' : 'Save Note & Complete Reading'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. PRACTICE QUIZ */}
                    {lesson.lesson_type === 'quiz' && (
                        <div className="bg-white border border-neutral-200 p-6 space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-neutral-200">
                                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
                                    <FileQuestion className="w-5 h-5 text-amber-600" />
                                    <span>
                                        {lesson.quiz_questions?.length || 0} Questions · Pass Score ≥ {lesson.pass_threshold_pct || 80}%
                                    </span>
                                </div>
                                {!lesson.quiz_keys_verified && (
                                    <span className="text-[11px] px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                                        Practice Check
                                    </span>
                                )}
                            </div>

                            {quizResult && (
                                <div
                                    className={`p-4 border text-sm ${
                                        quizResult.passed
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                            : 'bg-red-50 border-red-200 text-red-900'
                                    }`}
                                >
                                    <div className="font-semibold">
                                        {quizResult.passed ? 'Passed!' : 'Not quite yet — try again!'} Score: {quizResult.scorePct}% (
                                        {quizResult.correctCount}/{quizResult.totalQuestions} correct)
                                    </div>
                                    {quizResult.passed && navigation.next && (
                                        <button
                                            onClick={() => navigate(`/lesson/${navigation.next.id}`)}
                                            className="mt-2.5 px-4 py-2 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.14em]"
                                        >
                                            Continue to Next Lesson →
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="space-y-5">
                                {(lesson.quiz_questions || []).map((q: any, qIdx: number) => {
                                    const picked = quizAnswers[q.id] || [];
                                    const qRes = quizResult?.breakdown?.find((b: any) => b.id === q.id);

                                    return (
                                        <div key={q.id} className="p-4 bg-neutral-50 border border-neutral-200 space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="text-sm font-medium text-neutral-950 leading-relaxed">
                                                    <span className="font-bold mr-1.5">Q{qIdx + 1}.</span>
                                                    {q.prompt}
                                                </p>
                                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-neutral-200 text-neutral-700 shrink-0">
                                                    {q.type === 'multi' ? 'Multi-Select' : 'Single Choice'}
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                {q.options.map((opt: string, optIdx: number) => {
                                                    const checked = picked.includes(optIdx);
                                                    return (
                                                        <label
                                                            key={optIdx}
                                                            className={`flex items-start gap-3 p-3 border cursor-pointer text-sm transition ${
                                                                checked
                                                                    ? 'bg-white border-neutral-950 text-neutral-950 font-medium'
                                                                    : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400'
                                                            }`}
                                                        >
                                                            <input
                                                                type={q.type === 'multi' ? 'checkbox' : 'radio'}
                                                                name={q.id}
                                                                checked={checked}
                                                                onChange={() => toggleQuizOption(q.id, optIdx, q.type)}
                                                                className="mt-0.5 accent-neutral-950"
                                                            />
                                                            <span>{opt}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>

                                            {qRes && (
                                                <div className={`text-xs pt-1 ${qRes.correct ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}`}>
                                                    {qRes.correct ? '✓ Correct' : '✗ Review this question and retry.'}{' '}
                                                    {qRes.explanation && <span className="text-neutral-500 font-normal">— {qRes.explanation}</span>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={handleSubmitQuiz}
                                disabled={submittingQuiz}
                                className="w-full py-3.5 px-4 bg-[#030213] hover:bg-neutral-800 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition"
                            >
                                {submittingQuiz ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Quiz Answers'}
                            </button>
                        </div>
                    )}

                    {/* 4. HANDS-ON PROJECT DELIVERABLE */}
                    {lesson.lesson_type === 'project' && (
                        <div className="space-y-5">
                            <div className="bg-white border border-neutral-200 p-6 space-y-4">
                                <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-[0.16em]">
                                    <FolderKanban className="w-4 h-4" />
                                    <span>Hands-On Assignment · Next Lesson Unlocks Right After You Submit</span>
                                </div>
                                {lesson.project_brief && (
                                    <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed bg-neutral-50 p-4 border border-neutral-200">
                                        {lesson.project_brief}
                                    </p>
                                )}

                                {lesson.project_assets?.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">
                                            Download Project Templates & Scenario Files
                                        </div>
                                        <div className="grid sm:grid-cols-2 gap-2">
                                            {lesson.project_assets.map((asset: any, idx: number) => (
                                                <a
                                                    key={idx}
                                                    href={asset.downloadUrl || '#'}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 hover:border-neutral-950 text-xs text-neutral-900 font-medium transition"
                                                >
                                                    <span className="truncate">{asset.name}</span>
                                                    <Download className="w-4 h-4 text-neutral-700 shrink-0" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {projectSubmission && (
                                <div className="bg-white border border-neutral-200 p-5 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold uppercase tracking-wider text-neutral-900">Your Current Submission</span>
                                        <span
                                            className={`px-2.5 py-0.5 font-bold uppercase text-[10px] tracking-wider ${
                                                projectSubmission.review_status === 'approved'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : projectSubmission.review_status === 'revision_requested'
                                                      ? 'bg-amber-100 text-amber-800'
                                                      : 'bg-neutral-200 text-neutral-800'
                                            }`}
                                        >
                                            {projectSubmission.review_status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    {projectSubmission.file_name && (
                                        <div className="text-xs text-neutral-600">Uploaded file: {projectSubmission.file_name}</div>
                                    )}
                                    {projectSubmission.external_url && (
                                        <a
                                            href={projectSubmission.external_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-neutral-950 underline"
                                        >
                                            {projectSubmission.external_url} <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                    {projectSubmission.reviewer_feedback && (
                                        <div className="mt-2 p-3 bg-neutral-50 border-l-2 border-neutral-950 text-xs text-neutral-800">
                                            <strong>Reviewer Feedback:</strong> {projectSubmission.reviewer_feedback}
                                        </div>
                                    )}
                                </div>
                            )}

                            <form onSubmit={handleSubmitProject} className="bg-white border border-neutral-200 p-6 space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-900">
                                    {projectSubmission ? 'Update / Resubmit Deliverable' : 'Submit Your Deliverable'}
                                </h3>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-neutral-700">
                                        Upload File (.docx, .xlsx, .pdf, .pptx, .png)
                                    </label>
                                    <label className="flex items-center justify-center gap-2 p-4 border border-dashed border-neutral-300 bg-neutral-50 hover:border-neutral-950 cursor-pointer text-xs text-neutral-700">
                                        <UploadCloud className="w-4 h-4 text-neutral-900" />
                                        <span>{projectFile ? projectFile.name : 'Click to attach completed deliverable file'}</span>
                                        <input
                                            type="file"
                                            className="hidden"
                                            onChange={(e) => setProjectFile(e.target.files?.[0] || null)}
                                        />
                                    </label>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-neutral-700">
                                        Or Share Link (Figma / Power BI / Google Doc / Notion)
                                    </label>
                                    <input
                                        type="url"
                                        value={externalUrl}
                                        onChange={(e) => setExternalUrl(e.target.value)}
                                        placeholder="https://figma.com/file/..."
                                        className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-neutral-700">
                                        Implementation Reflection (min 40 chars)
                                    </label>
                                    <textarea
                                        rows={4}
                                        required
                                        minLength={40}
                                        value={reflection}
                                        onChange={(e) => setReflection(e.target.value)}
                                        placeholder="Summarize the key decisions you made and how you could apply this framework to a real CortDevs product..."
                                        className="w-full bg-white border border-neutral-300 p-3 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submittingProject}
                                    className="w-full py-3.5 px-4 bg-[#030213] hover:bg-neutral-800 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-2 transition"
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
                <div className="bg-white border border-neutral-200 p-5 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-neutral-900">
                        <MessageSquare className="w-4 h-4" />
                        <span>Module Team Discussion</span>
                    </div>

                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                        {comments.length === 0 ? (
                            <p className="text-xs text-neutral-500 py-4 text-center">
                                Ask a question or share an insight with your teammates on this module.
                            </p>
                        ) : (
                            comments.map((c) => (
                                <div key={c.id} className="p-3 bg-neutral-50 border border-neutral-200 space-y-1">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-semibold text-neutral-950">
                                            {c.author_name}
                                            {c.author_role === 'admin' && (
                                                <span className="ml-1.5 text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-[#030213] text-white">
                                                    Lead
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-neutral-400">{new Date(c.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs text-neutral-700 whitespace-pre-wrap">{c.body}</p>
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={handlePostComment} className="flex gap-2 pt-2 border-t border-neutral-200">
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Post a note or question..."
                            className="flex-1 bg-white border border-neutral-300 px-3 py-2 text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                        />
                        <button
                            type="submit"
                            disabled={postingComment || !newComment.trim()}
                            className="px-3 py-2 bg-[#030213] hover:bg-neutral-800 disabled:opacity-40 text-white"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
