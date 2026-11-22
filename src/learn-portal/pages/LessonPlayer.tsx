import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    CalendarClock,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    ExternalLink,
    FileQuestion,
    FolderKanban,
    Loader2,
    Lock,
    MessageSquareQuote,
    PlayCircle,
    Sparkles,
    UploadCloud,
} from 'lucide-react';
import { formatDuration, learnApi } from '../lib/api';
import { useLearnAuth } from '../context/LearnAuthContext';
import { CoursePartnerStrip } from '../components/BrandLogos';
import { LearnVideoPlayer, type VideoNote } from '../components/LearnVideoPlayer';
import { ReadingViewer } from '../components/ReadingViewer';
import {
    LessonCompanionPanel,
    type DialogueAccessInfo,
    type PeerReflectionsPayload,
} from '../components/LessonCompanionPanel';
import { ModuleDialogueModal, type DialogueScenarioData } from '../components/ModuleDialogueModal';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB cap to protect Supabase Free 1 GB storage
const HEARTBEAT_INTERVAL_MS = 30000; // 30s heartbeat (cuts free-tier API + DB load by ~89%)

export function LessonPlayer() {
    const { lessonId } = useParams();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isAdmin, user, enrollment, refreshProfile } = useLearnAuth();

    const fromVideo = searchParams.get('fromVideo') || '';
    const resumeParamRaw = Number(searchParams.get('t') || '0');
    const resumeParamSec = Number.isFinite(resumeParamRaw) && resumeParamRaw > 0 ? Math.floor(resumeParamRaw) : 0;

    const skipNextLoadForSlugRef = useRef<string | null>(null);
    const appliedResumeForLessonRef = useRef<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any | null>(null);
    const [lockedInfo, setLockedInfo] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [resumedBanner, setResumedBanner] = useState<string | null>(null);

    // Video state (refs prevent stale closures in heartbeat & pause/ended handlers)
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const segmentStartRef = useRef<number>(0);
    const maxWatchedRef = useRef<number>(0);
    const [maxWatchedSec, setMaxWatchedSec] = useState(0);
    const [uniqueWatchedSec, setUniqueWatchedSec] = useState(0);
    const [videoNotes, setVideoNotes] = useState<VideoNote[]>([]);

    // Reading state
    const readingContainerRef = useRef<HTMLDivElement | null>(null);
    const pendingDwellRef = useRef<number>(0);
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

    // Completion, Companion (Q&A, Key Takeaways, BAFOS Dialogue) state
    const [completing, setCompleting] = useState(false);
    const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [dialoguePosts, setDialoguePosts] = useState<any[]>([]);
    const [dialogueCount, setDialogueCount] = useState(0);
    const [dialogueAccess, setDialogueAccess] = useState<DialogueAccessInfo | null>(null);
    const [dialogueScenario, setDialogueScenario] = useState<DialogueScenarioData | null>(null);
    const [aiCoachConfigured, setAiCoachConfigured] = useState(false);
    const [peerReflections, setPeerReflections] = useState<PeerReflectionsPayload | null>(null);
    const [showInlineReflections, setShowInlineReflections] = useState(false);
    const [dialogueModalOpen, setDialogueModalOpen] = useState(false);

    const openDialogueParam = searchParams.get('openDialogue') === '1';

    const fetchCompanionData = useCallback((modId: string, lesId?: string, autoOpenIfUnlocked = false) => {
        const qs = new URLSearchParams({ moduleId: modId });
        if (lesId) qs.set('lessonId', lesId);
        learnApi(`lms/discussions?${qs.toString()}`)
            .then((d) => {
                setComments(d.comments || []);
                setDialoguePosts(d.dialoguePosts || []);
                setDialogueCount(Number(d.dialogueCount || 0));
                setDialogueAccess(d.dialogueAccess || null);
                setDialogueScenario(d.dialogueScenario || null);
                setAiCoachConfigured(Boolean(d.aiCoachConfigured));
                setPeerReflections(d.reflections || null);
                if (autoOpenIfUnlocked && d.dialogueAccess?.unlocked) {
                    setDialogueModalOpen(true);
                }
            })
            .catch(() => {});
    }, []);

    const loadLesson = useCallback(async () => {
        if (!lessonId) return;
        if (skipNextLoadForSlugRef.current === lessonId) {
            skipNextLoadForSlugRef.current = null;
            return;
        }
        setLoading(true);
        setError(null);
        setLockedInfo(null);
        setActionMsg(null);
        setQuizResult(null);
        setQuizAnswers({});
        setResumedBanner(null);
        appliedResumeForLessonRef.current = null;

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
            setVideoNotes(Array.isArray(res.progress?.notes_json) ? res.progress.notes_json : []);
            setExternalUrl(res.projectSubmission?.external_url || '');
            setReflection(res.projectSubmission?.reflection_notes || '');

            // Silently upgrade legacy /lesson/<uuid> URLs to canonical /lesson/<slug>
            if (res.lesson?.slug && lessonId !== res.lesson.slug) {
                skipNextLoadForSlugRef.current = res.lesson.slug;
                navigate(`/lesson/${res.lesson.slug}${location.search}`, { replace: true });
            }

            if (res.lesson?.module_id) {
                fetchCompanionData(res.lesson.module_id, res.lesson.id, openDialogueParam);
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
    }, [lessonId, location.search, navigate, fetchCompanionData, openDialogueParam]);

    useEffect(() => {
        loadLesson();
    }, [loadLesson]);

    const activeLessonId = data?.lesson?.id as string | undefined;
    const activeLessonType = data?.lesson?.lesson_type as string | undefined;
    const initialLastPosition = (data?.progress?.last_position_seconds as number) || 0;
    const activeLessonCompleted = data?.progress?.status === 'completed';

    const flushVideoHeartbeat = useCallback(
        async (forceLessonId?: string) => {
            const lid = forceLessonId || activeLessonId;
            const vid = videoRef.current;
            if (!lid || !vid) return;
            const cur = Math.floor(vid.currentTime);
            const start = Math.floor(segmentStartRef.current);
            if (cur > start && cur - start <= 105) {
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

    // Video 30-second heartbeat + exact resume position (?t= param or saved last_position_seconds)
    useEffect(() => {
        if (!activeLessonId || activeLessonType !== 'video') return;
        const vid = videoRef.current;
        let bannerTimer: number | null = null;

        const applyResumePosition = () => {
            if (!vid || appliedResumeForLessonRef.current === activeLessonId) return;
            const dur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 0;

            let targetSec = 0;
            if (resumeParamSec > 0) {
                targetSec = dur > 1 ? Math.min(resumeParamSec, Math.floor(dur - 1)) : resumeParamSec;
            } else if (initialLastPosition > 5 && (dur === 0 || initialLastPosition < dur - 10)) {
                targetSec = initialLastPosition;
            }

            appliedResumeForLessonRef.current = activeLessonId;
            if (targetSec > 2) {
                vid.currentTime = targetSec;
                segmentStartRef.current = targetSec;
                setResumedBanner(formatDuration(targetSec));
                bannerTimer = window.setTimeout(() => setResumedBanner(null), 5000);
            }
        };

        if (vid) {
            if (vid.readyState >= 1) {
                applyResumePosition();
            } else {
                vid.addEventListener('loadedmetadata', applyResumePosition, { once: true });
            }
        }

        const interval = window.setInterval(() => {
            if (!videoRef.current || videoRef.current.paused || document.visibilityState !== 'visible') return;
            flushVideoHeartbeat(activeLessonId);
        }, HEARTBEAT_INTERVAL_MS);

        return () => {
            if (vid) vid.removeEventListener('loadedmetadata', applyResumePosition);
            if (bannerTimer) window.clearTimeout(bannerTimer);
            window.clearInterval(interval);
        };
    }, [activeLessonId, activeLessonType, activeLessonCompleted, initialLastPosition, resumeParamSec, flushVideoHeartbeat]);

    // Reading active dwell timer (30s heartbeats while tab is visible + instant flush on complete) + scroll tracking
    useEffect(() => {
        if (!activeLessonId || activeLessonType !== 'reading') return;
        pendingDwellRef.current = 0;

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
            pendingDwellRef.current += 1;
            setDwellSec((prev) => prev + 1);

            if (pendingDwellRef.current >= 30) {
                const toSend = pendingDwellRef.current;
                pendingDwellRef.current = 0;
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

    const handleSaveVideoNotes = useCallback(
        async (nextNotes: VideoNote[]) => {
            setVideoNotes(nextNotes);
            if (!activeLessonId) return;
            try {
                const res = await learnApi('lms/progress-heartbeat', {
                    method: 'POST',
                    body: { lessonId: activeLessonId, notes: nextNotes },
                });
                if (Array.isArray(res?.progress?.notes_json)) {
                    setVideoNotes(res.progress.notes_json);
                }
            } catch {
                // keep optimistic local state
            }
        },
        [activeLessonId],
    );

    const handleVideoSeeking = () => {
        const vid = videoRef.current;
        if (!vid) return;
        // Free scrubbing & chapter jumping: simply reset segment anchor so skipped sections aren't falsely credited
        segmentStartRef.current = vid.currentTime;
    };

    const handleVideoRateChange = () => {
        const vid = videoRef.current;
        if (!vid || isAdmin) return;
        if (vid.playbackRate > 2) {
            vid.playbackRate = 2;
        }
    };

    const handleCompleteVideoOrReading = async (afterAction: 'continue' | 'return_video' | 'stay' = 'continue') => {
        if (!data) return;
        setCompleting(true);
        setActionMsg(null);
        try {
            if (data.lesson.lesson_type === 'video') {
                await flushVideoHeartbeat(data.lesson.id);
            } else if (data.lesson.lesson_type === 'reading') {
                const unsentDwell = pendingDwellRef.current;
                pendingDwellRef.current = 0;
                await learnApi('lms/progress-heartbeat', {
                    method: 'POST',
                    body: {
                        lessonId: data.lesson.id,
                        scrollPct: Math.max(scrollPct, 70),
                        dwellDeltaSeconds: Math.min(90, Math.max(unsentDwell, 1)),
                    },
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
            refreshProfile().catch(() => {});
            if (data.lesson.module_id && data.lesson.lesson_type === 'reading') {
                fetchCompanionData(data.lesson.module_id, data.lesson.id);
            }

            if (afterAction === 'return_video' && fromVideo) {
                navigate(`/lesson/${fromVideo}${resumeParamSec > 0 ? `?t=${resumeParamSec}` : ''}`);
                return;
            }

            const nextTarget = res.nextLesson || data.navigation?.next;
            if (afterAction === 'continue' && nextTarget) {
                navigate(`/lesson/${nextTarget.slug || nextTarget.id}`);
                return;
            }

            setActionMsg({
                type: 'success',
                text:
                    afterAction === 'stay'
                        ? 'Key takeaway note saved.'
                        : nextTarget
                          ? 'Lesson completed! Your next lesson is now unlocked.'
                          : 'Lesson completed! You have finished this track.',
            });
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
                if (data.lesson.module_id) {
                    fetchCompanionData(data.lesson.module_id, data.lesson.id);
                }
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
            if (data.lesson.module_id) {
                fetchCompanionData(data.lesson.module_id, data.lesson.id);
            }
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
                    {(lockedInfo.prerequisiteLessonSlug || lockedInfo.prerequisiteLessonId) && (
                        <Link
                            to={`/lesson/${lockedInfo.prerequisiteLessonSlug || lockedInfo.prerequisiteLessonId}`}
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
                            onClick={() => navigate(`/lesson/${navigation.prev.slug || navigation.prev.id}`)}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white border border-neutral-300 hover:border-neutral-950 text-xs font-bold uppercase tracking-[0.14em] text-neutral-800 transition"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Prev
                        </button>
                    )}
                    {navigation.next && (
                        <button
                            disabled={!isCompleted && !isAdmin}
                            onClick={() => navigate(`/lesson/${navigation.next.slug || navigation.next.id}`)}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#030213] hover:bg-neutral-800 disabled:opacity-35 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-[0.14em] text-white transition"
                        >
                            Next Lesson <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Guided 4-Step Module Flow Stepper (shows exact sequence: Watch & Read -> Quizzes -> Project -> BAFOS Dialogue) */}
            {lesson.module_flow && (() => {
                const mf = lesson.module_flow;
                const studyDone = Boolean(
                    (!mf.video || mf.video.completed) && mf.readingsCompleted >= mf.readingsTotal,
                );
                const quizzesTotal = mf.quizzes?.length || 0;
                const quizzesDone = (mf.quizzes || []).filter((q: any) => q.completed).length;
                const projectsTotal = mf.projects?.length || 0;
                const projectsDone = (mf.projects || []).filter((p: any) => p.completed).length;
                const firstPendingQuiz = (mf.quizzes || []).find((q: any) => !q.completed) || mf.quizzes?.[0];
                const firstPendingProject = (mf.projects || []).find((p: any) => !p.completed) || mf.projects?.[0];
                const dialogueReady = Boolean(isAdmin || dialogueAccess?.unlocked || mf.dialogueUnlocked);

                return (
                    <div className="bg-neutral-50 border border-neutral-200 px-3.5 py-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500 mr-1">
                            Module Flow:
                        </span>

                        {/* Step 1: Watch & Read Together */}
                        <button
                            type="button"
                            onClick={() => {
                                const targetSlug =
                                    lesson.lesson_type === 'video' && mf.firstUnreadReadingSlug
                                        ? mf.firstUnreadReadingSlug
                                        : mf.video?.slug || mf.firstUnreadReadingSlug;
                                if (targetSlug) navigate(`/lesson/${targetSlug}`);
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 border font-medium transition ${
                                lesson.lesson_type === 'video' || lesson.lesson_type === 'reading'
                                    ? 'bg-[#030213] text-white border-[#030213]'
                                    : studyDone
                                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                      : 'bg-white text-neutral-800 border-neutral-300 hover:border-neutral-950'
                            }`}
                        >
                            {studyDone && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                            <span>
                                1. Watch &amp; Read ({mf.readingsCompleted}/{mf.readingsTotal})
                            </span>
                        </button>

                        {quizzesTotal > 0 && (
                            <>
                                <span className="text-neutral-300">→</span>
                                <button
                                    type="button"
                                    disabled={!studyDone && !isAdmin}
                                    onClick={() => firstPendingQuiz && navigate(`/lesson/${firstPendingQuiz.slug || firstPendingQuiz.id}`)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 border font-medium transition disabled:opacity-45 disabled:cursor-not-allowed ${
                                        lesson.lesson_type === 'quiz'
                                            ? 'bg-[#030213] text-white border-[#030213]'
                                            : quizzesDone >= quizzesTotal
                                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                              : 'bg-white text-neutral-800 border-neutral-300 hover:border-neutral-950'
                                    }`}
                                >
                                    {quizzesDone >= quizzesTotal ? (
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                    ) : !studyDone && !isAdmin ? (
                                        <Lock className="w-3 h-3 shrink-0" />
                                    ) : null}
                                    <span>
                                        2. Quizzes ({quizzesDone}/{quizzesTotal})
                                    </span>
                                </button>
                            </>
                        )}

                        {projectsTotal > 0 && (
                            <>
                                <span className="text-neutral-300">→</span>
                                <button
                                    type="button"
                                    disabled={(!studyDone || quizzesDone < quizzesTotal) && !isAdmin}
                                    onClick={() =>
                                        firstPendingProject && navigate(`/lesson/${firstPendingProject.slug || firstPendingProject.id}`)
                                    }
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 border font-medium transition disabled:opacity-45 disabled:cursor-not-allowed ${
                                        lesson.lesson_type === 'project'
                                            ? 'bg-[#030213] text-white border-[#030213]'
                                            : projectsDone >= projectsTotal
                                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                              : 'bg-white text-neutral-800 border-neutral-300 hover:border-neutral-950'
                                    }`}
                                >
                                    {projectsDone >= projectsTotal ? (
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                    ) : (!studyDone || quizzesDone < quizzesTotal) && !isAdmin ? (
                                        <Lock className="w-3 h-3 shrink-0" />
                                    ) : null}
                                    <span>
                                        {quizzesTotal > 0 ? '3' : '2'}. Project ({projectsDone}/{projectsTotal})
                                    </span>
                                </button>
                            </>
                        )}

                        <span className="text-neutral-300">→</span>
                        <button
                            type="button"
                            disabled={!dialogueReady}
                            onClick={() => setDialogueModalOpen(true)}
                            title={
                                dialogueReady
                                    ? 'Apply this module directly to BAFOS in Dialogue & AI Coach'
                                    : 'Unlocks after completing this module’s quiz/project'
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 border font-medium transition disabled:opacity-45 disabled:cursor-not-allowed ${
                                dialogueReady
                                    ? 'bg-white text-neutral-950 border-neutral-950 hover:bg-[#030213] hover:text-white'
                                    : 'bg-white text-neutral-500 border-neutral-200'
                            }`}
                        >
                            {dialogueReady ? (
                                <Sparkles className="w-3 h-3 shrink-0" />
                            ) : (
                                <Lock className="w-3 h-3 shrink-0" />
                            )}
                            <span>
                                {1 + (quizzesTotal > 0 ? 1 : 0) + (projectsTotal > 0 ? 1 : 0) + 1}. BAFOS Dialogue &amp; AI Coach
                            </span>
                        </button>
                    </div>
                );
            })()}

            {lesson.lesson_type === 'reading' && fromVideo && (
                <div className="bg-[#030213] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                    <Link
                        to={`/lesson/${fromVideo}${resumeParamSec > 0 ? `?t=${resumeParamSec}` : ''}`}
                        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white hover:text-neutral-200"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Return to Module Video{resumeParamSec > 0 ? ` (at ${formatDuration(resumeParamSec)})` : ''}
                    </Link>
                    <span className="text-[11px] text-neutral-300">
                        Your video position is saved — return any time or continue to the next lesson below.
                    </span>
                </div>
            )}

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
                            onClick={() => navigate(`/lesson/${navigation.next.slug || navigation.next.id}`)}
                            className="shrink-0 px-3.5 py-1.5 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.14em]"
                        >
                            Next Lesson →
                        </button>
                    )}
                </div>
            )}

            {/* Full-Width Coursera-Style Video Player Studio (when lesson is a video) */}
            {lesson.lesson_type === 'video' && (
                <div className="space-y-4">
                    {lesson.video_signed_url ? (
                        <div className="relative">
                            {resumedBanner && (
                                <div className="mb-2 bg-neutral-900 text-white text-xs font-medium px-3.5 py-2 inline-flex items-center gap-2">
                                    <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                                    Resumed video at <strong className="font-mono">{resumedBanner}</strong>
                                </div>
                            )}
                            <LearnVideoPlayer
                                videoRef={videoRef}
                                src={lesson.video_signed_url}
                                transcriptUrl={lesson.transcript_signed_url}
                                title={lesson.title}
                                lessonSlug={lesson.slug || lesson.id}
                                durationSeconds={lesson.duration_seconds || 0}
                                chapters={(Array.isArray(lesson.chapters) ? lesson.chapters : []).map((ch: any) => ({
                                    title: ch.title,
                                    startSec: Number(ch.startSeconds ?? ch.startSec ?? 0),
                                }))}
                                moduleReadings={Array.isArray(lesson.module_readings) ? lesson.module_readings : []}
                                watermarkIdentity={[enrollment?.full_name || user?.email, enrollment?.email || user?.email, 'CortDevs']
                                    .filter(Boolean)
                                    .join(' · ')}
                                nextLesson={navigation.next}
                                canComplete={isAdmin || isCompleted || watchPct >= 70}
                                completing={completing}
                                notes={videoNotes}
                                isAdmin={isAdmin}
                                isCompleted={isCompleted}
                                maxWatchedSec={maxWatchedSec}
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
                                onSeekBlocked={() => {}}
                                onSaveNotes={handleSaveVideoNotes}
                                onCompleteAndContinue={() => {
                                    if (isCompleted && navigation.next) {
                                        navigate(`/lesson/${navigation.next.slug || navigation.next.id}`);
                                    } else {
                                        handleCompleteVideoOrReading('continue');
                                    }
                                }}
                                onReadingCompleted={(completedReadingId) => {
                                    setData((prev: any) =>
                                        prev
                                            ? {
                                                  ...prev,
                                                  lesson: {
                                                      ...prev.lesson,
                                                      module_readings: (prev.lesson.module_readings || []).map((r: any) =>
                                                          r.id === completedReadingId ? { ...r, completed: true } : r,
                                                      ),
                                                  },
                                              }
                                            : prev,
                                    );
                                    refreshProfile().catch(() => {});
                                }}
                            />
                        </div>
                    ) : (
                        <div className="bg-neutral-950 border border-neutral-800 text-white aspect-video flex flex-col items-center justify-center p-8 text-center space-y-3">
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
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Main Lesson Pane */}
                <div className="lg:col-span-2 min-w-0 space-y-6">
                    {/* 1. VIDEO PROGRESS & COMPLETION CARD */}
                    {lesson.lesson_type === 'video' && (
                        <div className="bg-white border border-neutral-200 p-5 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="text-xs font-semibold text-neutral-900">
                                        Video Progress: <span className="font-bold">{watchPct}%</span> (watch at least 70% to unlock next)
                                    </div>
                                    <div className="text-[11px] text-neutral-500">
                                        Watched: {formatDuration(uniqueWatchedSec)} / {formatDuration(lesson.duration_seconds)} · Up to 2x speed · Free chapter jumping
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (isCompleted && navigation.next) {
                                            navigate(`/lesson/${navigation.next.slug || navigation.next.id}`);
                                        } else {
                                            handleCompleteVideoOrReading('continue');
                                        }
                                    }}
                                    disabled={completing || (isCompleted && !navigation.next) || (!isCompleted && !isAdmin && watchPct < 70)}
                                    className="w-full sm:w-auto px-4 py-2.5 bg-[#030213] hover:bg-neutral-800 disabled:opacity-35 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 transition"
                                >
                                    {completing ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : isCompleted && navigation.next ? (
                                        <ArrowRight className="w-4 h-4" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4" />
                                    )}
                                    {isCompleted
                                        ? navigation.next
                                            ? 'Next Lesson'
                                            : 'Completed'
                                        : navigation.next
                                          ? 'Complete & Continue'
                                          : 'Mark Video Complete'}
                                </button>
                            </div>

                            <div className="h-2 w-full bg-neutral-200 overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${watchPct >= 70 ? 'bg-emerald-600' : 'bg-[#030213]'}`}
                                    style={{ width: `${watchPct}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* 2. READING LESSON */}
                    {lesson.lesson_type === 'reading' && (() => {
                        const effectiveMinDwell =
                            lesson.effective_min_dwell_seconds ||
                            Math.min(45, Math.max(15, Math.round((lesson.min_dwell_seconds || 60) * 0.25)));
                        return (
                        <div ref={readingContainerRef} className="bg-white border border-neutral-200 overflow-hidden">
                            <div className="px-4 sm:px-6 py-3.5 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
                                <span className="inline-flex items-center gap-1.5 font-medium">
                                    <BookOpen className="w-3.5 h-3.5 text-neutral-900" />
                                    {lesson.word_count?.toLocaleString() || 0} words · About {lesson.estimated_minutes} min read
                                </span>
                                <span className="inline-flex items-center gap-3">
                                    <span>Progress: <strong className="text-neutral-950">{scrollPct}%</strong></span>
                                    <span className="inline-flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        Time: <strong className="text-neutral-950">{dwellSec}s</strong> / {effectiveMinDwell}s
                                    </span>
                                </span>
                            </div>

                            <ReadingViewer
                                html={lesson.content_html || '<p>No reading content found.</p>'}
                                lessonKey={lesson.id}
                                scrollPct={scrollPct}
                                onListeningProgress={(pct) => setScrollPct((prev) => Math.max(prev, pct))}
                            />

                            <div className="p-4 sm:p-6 bg-neutral-50 border-t border-neutral-200 space-y-3">
                                <label className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-900">
                                    What Did You Learn? (Required to unlock next lesson)
                                </label>
                                <p className="text-xs text-neutral-500">
                                    Write a short sentence on one thing that stood out (at least 20 characters). Teammates who finish this exact reading can compare Key Takeaways with you.
                                </p>
                                <textarea
                                    rows={3}
                                    value={takeaway}
                                    onChange={(e) => setTakeaway(e.target.value)}
                                    placeholder="One thing I learned from this reading is..."
                                    className="w-full bg-white border border-neutral-300 p-3.5 text-base sm:text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                                />
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <span className="text-xs text-neutral-500">
                                        {takeaway.trim().length} / 20 characters minimum
                                        {!isCompleted && !isAdmin && dwellSec < effectiveMinDwell && (
                                            <span className="ml-2 text-neutral-400">
                                                · {effectiveMinDwell - dwellSec}s left
                                            </span>
                                        )}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                        {isCompleted ? (
                                            <>
                                                <button
                                                    onClick={() => handleCompleteVideoOrReading('stay')}
                                                    disabled={completing}
                                                    className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-neutral-300 hover:border-neutral-950 disabled:opacity-50 text-neutral-900 text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 transition"
                                                >
                                                    {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                    Update Note
                                                </button>
                                                {fromVideo ? (
                                                    <Link
                                                        to={`/lesson/${fromVideo}${resumeParamSec > 0 ? `?t=${resumeParamSec}` : ''}`}
                                                        className="flex-1 sm:flex-none px-5 py-2.5 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 transition"
                                                    >
                                                        <ArrowLeft className="w-3.5 h-3.5" />
                                                        Return to Video{resumeParamSec > 0 ? ` (${formatDuration(resumeParamSec)})` : ''}
                                                    </Link>
                                                ) : (
                                                    navigation.next && (
                                                        <button
                                                            onClick={() => navigate(`/lesson/${navigation.next.slug || navigation.next.id}`)}
                                                            className="flex-1 sm:flex-none px-5 py-2.5 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 transition"
                                                        >
                                                            Next Lesson <ArrowRight className="w-3.5 h-3.5" />
                                                        </button>
                                                    )
                                                )}
                                            </>
                                        ) : fromVideo ? (
                                            <>
                                                <button
                                                    onClick={() => handleCompleteVideoOrReading('return_video')}
                                                    disabled={completing}
                                                    className="flex-1 sm:flex-none px-5 py-2.5 bg-[#030213] hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 transition"
                                                >
                                                    {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                    Complete &amp; Return to Video{resumeParamSec > 0 ? ` (${formatDuration(resumeParamSec)})` : ''}
                                                </button>
                                                {navigation.next && (
                                                    <button
                                                        onClick={() => handleCompleteVideoOrReading('continue')}
                                                        disabled={completing}
                                                        className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-neutral-300 hover:border-neutral-950 disabled:opacity-50 text-neutral-900 text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 transition"
                                                    >
                                                        Complete &amp; Next <ArrowRight className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleCompleteVideoOrReading('continue')}
                                                disabled={completing}
                                                className="w-full sm:w-auto px-5 py-2.5 bg-[#030213] hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-[0.16em] inline-flex items-center justify-center gap-2 transition"
                                            >
                                                {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                {navigation.next ? 'Complete & Continue' : 'Save Note & Complete Reading'}
                                                {navigation.next && <ArrowRight className="w-3.5 h-3.5" />}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Compact Post-to-Reveal Teammate Reflections right in context (collapsed by default) */}
                                {peerReflections && peerReflections.totalCount > 0 && (
                                    <div className="pt-3 border-t border-neutral-200 space-y-2.5 text-left">
                                        {!peerReflections.unlocked ? (
                                            <div className="flex items-center gap-2 text-xs text-neutral-600">
                                                <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                                <span>
                                                    Share your takeaway above to unlock{' '}
                                                    <strong>{peerReflections.totalCount}</strong> teammate{' '}
                                                    {peerReflections.totalCount === 1 ? 'reflection' : 'reflections'} on this reading.
                                                </span>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowInlineReflections((s) => !s)}
                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-800 hover:text-neutral-950"
                                                >
                                                    <MessageSquareQuote className="w-3.5 h-3.5" />
                                                    <span>
                                                        Key Takeaways from Teammates on This Reading ({peerReflections.items.length})
                                                    </span>
                                                    {showInlineReflections ? (
                                                        <ChevronUp className="w-3.5 h-3.5" />
                                                    ) : (
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                                {showInlineReflections && (
                                                    <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
                                                        {peerReflections.items.map((item, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="p-3 bg-white border border-neutral-200 space-y-1 text-left"
                                                            >
                                                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-950">
                                                                    <span>{item.authorName}</span>
                                                                    {item.studyGroup && (
                                                                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-neutral-100 text-neutral-600">
                                                                            {item.studyGroup}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-neutral-700 leading-relaxed">
                                                                    “{item.takeaway}”
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        );
                    })()}

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
                                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                        {quizResult.passed && (quizResult.nextLesson || navigation.next) && (
                                            <button
                                                onClick={() => {
                                                    const nextTarget = quizResult.nextLesson || navigation.next;
                                                    navigate(`/lesson/${nextTarget.slug || nextTarget.id}`);
                                                }}
                                                className="px-4 py-2 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.14em]"
                                            >
                                                Continue to Next Lesson →
                                            </button>
                                        )}
                                        {quizResult.passed && (isAdmin || dialogueAccess?.unlocked) && dialogueScenario && (
                                            <button
                                                type="button"
                                                onClick={() => setDialogueModalOpen(true)}
                                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-neutral-900 hover:bg-neutral-100 text-neutral-950 text-xs font-bold uppercase tracking-[0.14em]"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" /> Apply to BAFOS (Dialogue &amp; AI Coach)
                                            </button>
                                        )}
                                    </div>
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

                                {/* Recommended BAFOS Practical Application Lens */}
                                {lesson.bafos_project_lens && (
                                    <div className="p-4 bg-[#030213] text-white space-y-2.5 text-left">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            <span>{lesson.bafos_project_lens.headline}</span>
                                        </div>
                                        <p className="text-xs text-neutral-200 leading-relaxed">
                                            {lesson.bafos_project_lens.focusPrompt}
                                        </p>
                                        <p className="text-xs text-neutral-300 leading-relaxed border-l-2 border-blue-400 pl-3">
                                            <strong className="text-white">Suggested BAFOS Deliverable:</strong>{' '}
                                            {lesson.bafos_project_lens.suggestedDeliverable}
                                        </p>
                                        {Array.isArray(lesson.bafos_project_lens.bafosToolsInScope) && (
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {lesson.bafos_project_lens.bafosToolsInScope.map((tool: string, tIdx: number) => (
                                                    <span
                                                        key={tIdx}
                                                        className="px-2 py-0.5 text-[10px] font-semibold bg-white/10 border border-white/15 text-neutral-100"
                                                    >
                                                        {tool}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {lesson.project_assets?.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">
                                            Project Templates &amp; Files
                                        </div>
                                        <div className="grid sm:grid-cols-2 gap-2">
                                            {lesson.project_assets.map((asset: any, idx: number) =>
                                                asset.lockedUntilSubmit ? (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-neutral-100 border border-neutral-200 text-xs text-neutral-500"
                                                    >
                                                        <span className="truncate">
                                                            {asset.name}{' '}
                                                            <em className="text-[10px] text-neutral-400">(Unlocks after you submit)</em>
                                                        </span>
                                                        <Lock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                                    </div>
                                                ) : (
                                                    <a
                                                        key={idx}
                                                        href={asset.downloadUrl || '#'}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 hover:border-neutral-950 text-xs text-neutral-900 font-medium transition"
                                                    >
                                                        <span className="truncate">
                                                            {asset.name}
                                                            {asset.isExemplar && (
                                                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold uppercase">
                                                                    Reference Example
                                                                </span>
                                                            )}
                                                        </span>
                                                        <Download className="w-4 h-4 text-neutral-700 shrink-0" />
                                                    </a>
                                                ),
                                            )}
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

                {/* Right Sidebar: Distraction-Free Module Companion (Q&A · Key Takeaways on Readings/Projects · Gated BAFOS Dialogue) */}
                <LessonCompanionPanel
                    moduleId={lesson.module_id}
                    lessonId={lesson.id}
                    lessonType={lesson.lesson_type}
                    isAdmin={isAdmin}
                    currentUserId={user?.id}
                    comments={comments}
                    setComments={setComments}
                    dialoguePosts={dialoguePosts}
                    dialogueCount={dialogueCount}
                    dialogueAccess={dialogueAccess}
                    dialogueScenario={dialogueScenario}
                    aiCoachConfigured={aiCoachConfigured}
                    reflections={peerReflections}
                    onOpenDialogue={() => setDialogueModalOpen(true)}
                    onError={(msg) => setActionMsg({ type: 'error', text: msg })}
                />
            </div>

            {/* Centered Focus Modal for Module Dialogue (Cohort Scenario + Optional AI Stakeholder Coach) */}
            {dialogueScenario && (
                <ModuleDialogueModal
                    open={dialogueModalOpen}
                    onClose={() => setDialogueModalOpen(false)}
                    moduleId={lesson.module_id}
                    moduleTitle={lesson.module_title || 'Current Module'}
                    scenario={dialogueScenario}
                    dialoguePosts={dialoguePosts}
                    aiCoachConfigured={aiCoachConfigured}
                    currentUserId={user?.id}
                    isAdmin={isAdmin}
                    onPostCreated={(post) => setDialoguePosts((prev) => [...prev, post])}
                    onHelpfulToggled={(commentId, count, viewerMarked) =>
                        setDialoguePosts((prev) =>
                            prev.map((p) =>
                                p.id === commentId
                                    ? { ...p, helpful_count: count, viewer_marked_helpful: viewerMarked }
                                    : p,
                            ),
                        )
                    }
                />
            )}
        </div>
    );
}
