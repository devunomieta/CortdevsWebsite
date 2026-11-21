import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
    BookMarked,
    BookOpen,
    Captions,
    CheckCircle2,
    ExternalLink,
    FileText,
    ListVideo,
    Maximize,
    Minimize,
    Pause,
    PictureInPicture2,
    Play,
    Plus,
    RectangleHorizontal,
    RotateCcw,
    RotateCw,
    Search,
    Trash2,
    Volume2,
    VolumeX,
    X,
} from 'lucide-react';
import { CourseraLogo, MicrosoftLogo } from './BrandLogos';
import { formatDuration } from '../lib/api';

export interface VideoChapter {
    title: string;
    startSec: number;
}

export interface VideoNote {
    id: string;
    timeSeconds: number;
    text: string;
    createdAt: string;
}

export interface ModuleReadingItem {
    id: string;
    title: string;
    estimated_minutes: number;
    completed: boolean;
}

interface VttCue {
    id: number;
    start: number;
    end: number;
    text: string;
}

type SideTab = 'transcript' | 'notes' | 'chapters' | 'readings';

const WATERMARK_POSITIONS = [
    'top-[16%] left-[7%]',
    'top-[44%] left-[12%]',
    'top-[26%] right-[8%]',
    'bottom-[24%] left-[10%]',
    'bottom-[22%] right-[8%]',
];

function parseVttTimestamp(raw: string): number {
    const clean = raw.trim().replace(',', '.');
    const parts = clean.split(':').map(Number);
    if (parts.some((n) => Number.isNaN(n))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
}

function parseWebVtt(raw: string): VttCue[] {
    const normalized = raw.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
    const blocks = normalized.split(/\n{2,}/);
    const cues: VttCue[] = [];
    let id = 0;

    for (const block of blocks) {
        const lines = block
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
        if (lines.length === 0) continue;
        if (lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE') || lines[0].startsWith('STYLE')) continue;

        const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
        if (timeLineIdx === -1) continue;

        const [startRaw, endRawPart] = lines[timeLineIdx].split('-->');
        const endRaw = (endRawPart || '').trim().split(/\s+/)[0] || '';
        const start = parseVttTimestamp(startRaw);
        const end = parseVttTimestamp(endRaw);
        const text = lines
            .slice(timeLineIdx + 1)
            .join(' ')
            .replace(/<[^>]*>/g, '')
            .trim();

        if (text && end >= start) {
            cues.push({ id: id++, start, end, text });
        }
    }
    return cues;
}

export function LearnVideoPlayer({
    videoRef,
    src,
    transcriptUrl,
    title,
    durationSeconds,
    chapters,
    moduleReadings = [],
    watermarkIdentity = '',
    notes,
    isAdmin,
    isCompleted,
    maxWatchedSec,
    onSeeking,
    onRateChange,
    onPlay,
    onPause,
    onEnded,
    onSeekBlocked,
    onSaveNotes,
}: {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    src: string;
    transcriptUrl?: string | null;
    title: string;
    durationSeconds: number;
    chapters: VideoChapter[];
    moduleReadings?: ModuleReadingItem[];
    watermarkIdentity?: string;
    notes: VideoNote[];
    isAdmin: boolean;
    isCompleted: boolean;
    maxWatchedSec: number;
    onSeeking: () => void;
    onRateChange: () => void;
    onPlay: () => void;
    onPause: () => void;
    onEnded: () => void;
    onSeekBlocked: () => void;
    onSaveNotes: (nextNotes: VideoNote[]) => Promise<void>;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const activeCueRef = useRef<HTMLButtonElement | null>(null);
    const controlsTimerRef = useRef<number | null>(null);
    const noteInputRef = useRef<HTMLTextAreaElement | null>(null);

    // Playback UI state
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(durationSeconds || 0);
    const [bufferedEnd, setBufferedEnd] = useState(0);
    const [muted, setMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [theaterMode, setTheaterMode] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [showCaptions, setShowCaptions] = useState(false);

    // Side panel state
    const [panelOpen, setPanelOpen] = useState(true);
    const [activeTab, setActiveTab] = useState<SideTab>(chapters.length > 0 ? 'chapters' : 'transcript');
    const [cues, setCues] = useState<VttCue[]>([]);
    const [transcriptStatus, setTranscriptStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
    const [transcriptSearch, setTranscriptSearch] = useState('');
    const [autoScrollTranscript, setAutoScrollTranscript] = useState(true);

    // Personal timestamped notes state
    const [noteDraft, setNoteDraft] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    // Subtle drifting forensic watermark index (rotates every 18s while playing)
    const [watermarkPosIdx, setWatermarkPosIdx] = useState(0);
    useEffect(() => {
        if (!watermarkIdentity) return;
        const id = window.setInterval(() => {
            setWatermarkPosIdx((prev) => (prev + 1) % WATERMARK_POSITIONS.length);
        }, 18000);
        return () => window.clearInterval(id);
    }, [watermarkIdentity]);

    const pipSupported = typeof document !== 'undefined' && Boolean((document as any).pictureInPictureEnabled);
    const speedOptions = isAdmin ? [0.75, 1, 1.25, 1.5, 1.75, 2] : [0.75, 1, 1.25, 1.5, 1.75];

    // Fetch optional .vtt transcript from private R2 (404 handled cleanly without noise)
    useEffect(() => {
        if (!transcriptUrl) {
            setCues([]);
            setTranscriptStatus('unavailable');
            return;
        }
        let cancelled = false;
        setTranscriptStatus('loading');
        fetch(transcriptUrl)
            .then((res) => {
                if (!res.ok) return null;
                return res.text();
            })
            .then((text) => {
                if (cancelled) return;
                if (!text) {
                    setCues([]);
                    setTranscriptStatus('unavailable');
                    return;
                }
                const parsed = parseWebVtt(text);
                setCues(parsed);
                setTranscriptStatus(parsed.length > 0 ? 'ready' : 'unavailable');
                if (parsed.length > 0) {
                    setActiveTab('transcript');
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setCues([]);
                    setTranscriptStatus('unavailable');
                }
            });
        return () => {
            cancelled = true;
        };
    }, [transcriptUrl]);

    // Sync fullscreen state
    useEffect(() => {
        const handleFsChange = () => {
            const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
            setIsFullscreen(Boolean(fsEl));
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        document.addEventListener('webkitfullscreenchange', handleFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFsChange);
            document.removeEventListener('webkitfullscreenchange', handleFsChange);
        };
    }, []);

    // Auto-hide controls cleanly after 3s of playback
    const bumpControlsVisibility = useCallback(() => {
        setControlsVisible(true);
        if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
        if (playing) {
            controlsTimerRef.current = window.setTimeout(() => {
                setControlsVisible(false);
                setSpeedMenuOpen(false);
            }, 3000);
        }
    }, [playing]);

    useEffect(() => {
        if (!playing) {
            setControlsVisible(true);
            if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
        } else {
            bumpControlsVisibility();
        }
        return () => {
            if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
        };
    }, [playing, bumpControlsVisibility]);

    const seekToTime = useCallback(
        (targetSec: number) => {
            const vid = videoRef.current;
            if (!vid) return;
            const totalDur = vid.duration || duration || 0;
            const clamped = Math.max(0, Math.min(totalDur || targetSec, targetSec));
            if (!isAdmin && !isCompleted && clamped > maxWatchedSec + 15) {
                vid.currentTime = maxWatchedSec;
                onSeekBlocked();
                return;
            }
            vid.currentTime = clamped;
            setCurrentTime(clamped);
        },
        [videoRef, duration, isAdmin, isCompleted, maxWatchedSec, onSeekBlocked],
    );

    const togglePlay = useCallback(() => {
        const vid = videoRef.current;
        if (!vid) return;
        if (vid.paused) {
            vid.play().catch(() => {});
        } else {
            vid.pause();
        }
    }, [videoRef]);

    const toggleMute = useCallback(() => {
        const vid = videoRef.current;
        if (!vid) return;
        const nextMuted = !vid.muted;
        vid.muted = nextMuted;
        setMuted(nextMuted);
    }, [videoRef]);

    const handleVolumeChange = (val: number) => {
        const vid = videoRef.current;
        if (!vid) return;
        const clamped = Math.max(0, Math.min(1, val));
        vid.volume = clamped;
        vid.muted = clamped === 0;
        setVolume(clamped);
        setMuted(clamped === 0);
    };

    const handleSelectSpeed = (rate: number) => {
        const vid = videoRef.current;
        if (!vid) return;
        vid.playbackRate = rate;
        setPlaybackRate(rate);
        setSpeedMenuOpen(false);
    };

    const toggleFullscreen = useCallback(async () => {
        const container = containerRef.current as any;
        const vid = videoRef.current as any;
        try {
            if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
                if (document.exitFullscreen) await document.exitFullscreen();
                else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
            } else if (container?.requestFullscreen) {
                await container.requestFullscreen();
            } else if (container?.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (vid?.webkitEnterFullscreen) {
                // iOS Safari fallback
                vid.webkitEnterFullscreen();
            }
        } catch {
            // ignore rejected fullscreen promise
        }
    }, [videoRef]);

    const togglePiP = useCallback(async () => {
        const vid = videoRef.current as any;
        if (!vid) return;
        try {
            if ((document as any).pictureInPictureElement) {
                await (document as any).exitPictureInPicture();
            } else if (vid.requestPictureInPicture) {
                await vid.requestPictureInPicture();
            }
        } catch {
            // ignore unsupported PiP errors
        }
    }, [videoRef]);

    // Keyboard shortcuts (ignored while typing inside inputs/textareas)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement | null)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) {
                return;
            }
            if (e.key === ' ' || e.key.toLowerCase() === 'k') {
                e.preventDefault();
                togglePlay();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                seekToTime((videoRef.current?.currentTime || 0) - 10);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                seekToTime((videoRef.current?.currentTime || 0) + 10);
            } else if (e.key.toLowerCase() === 'm') {
                toggleMute();
            } else if (e.key.toLowerCase() === 'f') {
                toggleFullscreen();
            } else if (e.key.toLowerCase() === 't') {
                setTheaterMode((p) => !p);
            } else if (e.key.toLowerCase() === 'c' && cues.length > 0) {
                setShowCaptions((p) => !p);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [togglePlay, seekToTime, toggleMute, toggleFullscreen, cues.length, videoRef]);

    const activeCue = useMemo(
        () => cues.find((c) => currentTime >= c.start && currentTime <= c.end + 0.2) || null,
        [cues, currentTime],
    );

    const activeChapter = useMemo(() => {
        if (!chapters.length) return null;
        let current = chapters[0];
        for (const ch of chapters) {
            if (currentTime >= ch.startSec) current = ch;
        }
        return current;
    }, [chapters, currentTime]);

    // Auto-scroll active transcript cue cleanly into view
    useEffect(() => {
        if (autoScrollTranscript && activeTab === 'transcript' && panelOpen && activeCueRef.current) {
            activeCueRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [activeCue?.id, autoScrollTranscript, activeTab, panelOpen]);

    const filteredCues = useMemo(() => {
        const q = transcriptSearch.trim().toLowerCase();
        if (!q) return cues;
        return cues.filter((c) => c.text.toLowerCase().includes(q));
    }, [cues, transcriptSearch]);

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = noteDraft.trim();
        if (!text) return;
        setSavingNote(true);
        try {
            const newNote: VideoNote = {
                id: `note-${Date.now()}`,
                timeSeconds: Math.floor(videoRef.current?.currentTime || currentTime || 0),
                text,
                createdAt: new Date().toISOString(),
            };
            const nextNotes = [newNote, ...notes].slice(0, 30);
            await onSaveNotes(nextNotes);
            setNoteDraft('');
        } finally {
            setSavingNote(false);
        }
    };

    const handleDeleteNote = async (id: string) => {
        setSavingNote(true);
        try {
            await onSaveNotes(notes.filter((n) => n.id !== id));
        } finally {
            setSavingNote(false);
        }
    };

    const openRailTab = (tab: SideTab) => {
        if (theaterMode) setTheaterMode(false);
        if (panelOpen && activeTab === tab) {
            setPanelOpen(false);
        } else {
            setActiveTab(tab);
            setPanelOpen(true);
        }
    };

    const handleQuickNoteClick = () => {
        if (isFullscreen) toggleFullscreen();
        setTheaterMode(false);
        setActiveTab('notes');
        setPanelOpen(true);
        window.setTimeout(() => noteInputRef.current?.focus(), 120);
    };

    const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
    const bufferedPct = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;
    const watchedLimitPct = duration > 0 ? Math.min(100, (maxWatchedSec / duration) * 100) : 0;

    return (
        <div className="bg-white border border-neutral-200 overflow-hidden">
            {/* Co-branded top bar */}
            <div className="px-4 py-2.5 bg-[#030213] text-white flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
                <div className="inline-flex items-center gap-3">
                    <MicrosoftLogo dark className="h-3.5" />
                    <span className="text-white/30 text-xs">×</span>
                    <CourseraLogo dark />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                    CortDevs Learn · Protected Stream
                </span>
            </div>

            {/* Coursera-style Split Layout: Video Stage + Collapsible Side Drawer + Vertical Icon Rail */}
            <div className="flex flex-col lg:flex-row bg-[#05050b]">
                {/* Video Stage Wrapper (Fullscreen target so custom controls + CortDevs + user forensic watermark stay visible in Fullscreen!) */}
                <div
                    ref={containerRef}
                    onMouseMove={bumpControlsVisibility}
                    onTouchStart={bumpControlsVisibility}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`relative bg-black flex-1 min-w-0 flex flex-col justify-center select-none ${
                        isFullscreen ? 'w-screen h-screen' : theaterMode ? 'w-full' : ''
                    }`}
                >
                    <video
                        ref={videoRef}
                        src={src}
                        playsInline
                        preload="metadata"
                        controlsList="nodownload"
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={togglePlay}
                        onLoadedMetadata={() => {
                            if (videoRef.current && Number.isFinite(videoRef.current.duration)) {
                                setDuration(videoRef.current.duration);
                            }
                        }}
                        onTimeUpdate={() => {
                            const vid = videoRef.current;
                            if (!vid) return;
                            setCurrentTime(vid.currentTime);
                            if (vid.buffered.length > 0) {
                                setBufferedEnd(vid.buffered.end(vid.buffered.length - 1));
                            }
                        }}
                        onSeeking={onSeeking}
                        onRateChange={() => {
                            if (videoRef.current) setPlaybackRate(videoRef.current.playbackRate);
                            onRateChange();
                        }}
                        onPlay={() => {
                            setPlaying(true);
                            onPlay();
                        }}
                        onPause={() => {
                            setPlaying(false);
                            onPause();
                        }}
                        onEnded={() => {
                            setPlaying(false);
                            onEnded();
                        }}
                        className={`w-full cursor-pointer object-contain ${
                            isFullscreen ? 'h-full' : theaterMode ? 'max-h-[76vh] aspect-video' : 'max-h-[540px] aspect-video'
                        }`}
                    />

                    {/* Subtle translucent CortDevs Watermark Overlay (stays pinned in Normal, Theater & Fullscreen) */}
                    <div className="pointer-events-none select-none absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-1.5 px-2.5 py-1 bg-[#030213]/45 backdrop-blur-[2px] border border-white/15 text-white/70">
                        <span className="text-[11px] font-semibold tracking-tight">
                            Cort<span className="italic">Devs</span>
                        </span>
                        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/55 border-l border-white/25 pl-1.5">
                            Learn
                        </span>
                    </div>

                    {/* Subtle Drifting User-Identity Forensic Watermark (~12% opacity, traces screen recordings in Normal + Fullscreen) */}
                    {watermarkIdentity && (
                        <div
                            aria-hidden="true"
                            className={`pointer-events-none select-none absolute z-20 transition-all duration-1000 ease-in-out ${WATERMARK_POSITIONS[watermarkPosIdx]}`}
                        >
                            <span className="text-[10px] sm:text-[11px] font-mono tracking-wide text-white/[0.14] drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] whitespace-nowrap">
                                {watermarkIdentity}
                            </span>
                        </div>
                    )}

                    {/* Floating Top-Left Lesson / Chapter Title Pill (auto-fades with controls) */}
                    <div
                        className={`pointer-events-none absolute top-3 left-3 sm:top-4 sm:left-4 z-20 max-w-[65%] transition-opacity duration-300 ${
                            controlsVisible || !playing ? 'opacity-100' : 'opacity-0'
                        }`}
                    >
                        <div className="px-3 py-1.5 bg-black/60 backdrop-blur-sm text-white text-xs sm:text-sm font-medium truncate">
                            {activeChapter ? activeChapter.title : title}
                        </div>
                    </div>

                    {/* Center Play Button Overlay when paused */}
                    {!playing && (
                        <button
                            type="button"
                            onClick={togglePlay}
                            aria-label="Play video"
                            className="absolute inset-0 m-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#030213]/80 hover:bg-[#030213] border border-white/30 text-white flex items-center justify-center transition z-10 shadow-xl"
                        >
                            <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5" />
                        </button>
                    )}

                    {/* Synced Closed Captions Overlay */}
                    {showCaptions && activeCue && (
                        <div
                            className={`pointer-events-none absolute inset-x-4 z-20 flex justify-center transition-all duration-200 ${
                                controlsVisible ? 'bottom-16 sm:bottom-20' : 'bottom-6'
                            }`}
                        >
                            <div className="max-w-2xl px-3.5 py-1.5 bg-black/80 text-white text-xs sm:text-sm text-center leading-snug rounded">
                                {activeCue.text}
                            </div>
                        </div>
                    )}

                    {/* Coursera-Style Custom Bottom Controls Bar */}
                    <div
                        className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-8 pb-2.5 px-3 sm:px-4 transition-opacity duration-200 ${
                            controlsVisible || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                    >
                        {/* Interactive Scrub Bar */}
                        <div
                            role="slider"
                            aria-label="Video progress"
                            aria-valuemin={0}
                            aria-valuemax={Math.round(duration)}
                            aria-valuenow={Math.round(currentTime)}
                            tabIndex={0}
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                seekToTime(ratio * duration);
                            }}
                            className="group relative h-3 flex items-center cursor-pointer mb-1.5"
                        >
                            <div className="w-full h-1 group-hover:h-1.5 bg-white/25 relative transition-all">
                                {/* Buffered */}
                                <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${bufferedPct}%` }} />
                                {/* Watched max watermark for learners */}
                                {!isAdmin && !isCompleted && watchedLimitPct > progressPct && (
                                    <div
                                        className="absolute inset-y-0 left-0 bg-blue-400/35"
                                        style={{ width: `${watchedLimitPct}%` }}
                                    />
                                )}
                                {/* Current progress */}
                                <div className="absolute inset-y-0 left-0 bg-blue-500" style={{ width: `${progressPct}%` }} />
                                {/* Chapter ticks */}
                                {duration > 0 &&
                                    chapters.map((ch, idx) => {
                                        const leftPct = Math.min(100, (ch.startSec / duration) * 100);
                                        if (leftPct <= 0 || leftPct >= 100) return null;
                                        return (
                                            <span
                                                key={idx}
                                                title={ch.title}
                                                className="absolute top-0 bottom-0 w-0.5 bg-black/70"
                                                style={{ left: `${leftPct}%` }}
                                            />
                                        );
                                    })}
                                {/* Scrub thumb */}
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-400 border-2 border-white shadow opacity-90 group-hover:scale-110 transition-transform"
                                    style={{ left: `${progressPct}%` }}
                                />
                            </div>
                        </div>

                        {/* Control Buttons Row */}
                        <div className="flex items-center justify-between gap-2 text-white">
                            {/* Left cluster: Play, Volume, -10s, Time, +10s */}
                            <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                                <button
                                    type="button"
                                    onClick={togglePlay}
                                    aria-label={playing ? 'Pause' : 'Play'}
                                    className="p-1.5 hover:bg-white/15 rounded transition"
                                >
                                    {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                                </button>

                                <div className="group/vol flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={toggleMute}
                                        aria-label={muted ? 'Unmute' : 'Mute'}
                                        className="p-1.5 hover:bg-white/15 rounded transition"
                                    >
                                        {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                    </button>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        value={muted ? 0 : volume}
                                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                                        aria-label="Volume"
                                        className="hidden sm:block w-14 accent-blue-500 cursor-pointer"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => seekToTime(currentTime - 10)}
                                    title="Rewind 10 seconds"
                                    aria-label="Rewind 10 seconds"
                                    className="p-1.5 hover:bg-white/15 rounded transition inline-flex items-center gap-0.5 text-[11px] font-semibold"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">10</span>
                                </button>

                                <span className="text-[11px] sm:text-xs font-mono tabular-nums text-white/90 whitespace-nowrap">
                                    {formatDuration(currentTime)} <span className="text-white/50">/</span> {formatDuration(duration)}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => seekToTime(currentTime + 10)}
                                    title="Forward 10 seconds"
                                    aria-label="Forward 10 seconds"
                                    className="p-1.5 hover:bg-white/15 rounded transition inline-flex items-center gap-0.5 text-[11px] font-semibold"
                                >
                                    <RotateCw className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">10</span>
                                </button>
                            </div>

                            {/* Right cluster: Speed, CC, Note, Theater, PiP, Fullscreen */}
                            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                {/* Speed Selector */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setSpeedMenuOpen((p) => !p)}
                                        title="Playback speed"
                                        className="px-2 py-1 hover:bg-white/15 rounded text-xs font-bold tabular-nums transition"
                                    >
                                        {playbackRate}x
                                    </button>
                                    {speedMenuOpen && (
                                        <div className="absolute right-0 bottom-9 bg-[#0b0b14] border border-white/20 py-1 min-w-[76px] shadow-xl z-40">
                                            {speedOptions.map((rate) => (
                                                <button
                                                    key={rate}
                                                    type="button"
                                                    onClick={() => handleSelectSpeed(rate)}
                                                    className={`w-full px-3 py-1.5 text-left text-xs font-mono hover:bg-white/15 transition ${
                                                        playbackRate === rate ? 'text-blue-400 font-bold' : 'text-white'
                                                    }`}
                                                >
                                                    {rate}x
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Captions toggle */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (cues.length > 0) setShowCaptions((p) => !p);
                                        else openRailTab('transcript');
                                    }}
                                    title={cues.length > 0 ? 'Toggle captions (C)' : 'Transcript / Captions'}
                                    aria-label="Toggle captions"
                                    className={`p-1.5 rounded transition ${
                                        showCaptions && cues.length > 0
                                            ? 'bg-blue-600 text-white'
                                            : 'hover:bg-white/15 text-white/85'
                                    }`}
                                >
                                    <Captions className="w-4 h-4" />
                                </button>

                                {/* Quick Timestamped Note */}
                                <button
                                    type="button"
                                    onClick={handleQuickNoteClick}
                                    title="Add note at current timestamp"
                                    aria-label="Add note at current timestamp"
                                    className="hidden sm:inline-flex p-1.5 hover:bg-white/15 rounded text-white/85 transition"
                                >
                                    <BookMarked className="w-4 h-4" />
                                </button>

                                {/* Theater / Wide View toggle (Desktop) */}
                                {!isFullscreen && (
                                    <button
                                        type="button"
                                        onClick={() => setTheaterMode((p) => !p)}
                                        title={theaterMode ? 'Exit wide view (T)' : 'Wide view (T)'}
                                        aria-label="Toggle wide view"
                                        className={`hidden lg:inline-flex p-1.5 rounded transition ${
                                            theaterMode ? 'bg-white/20 text-white' : 'hover:bg-white/15 text-white/85'
                                        }`}
                                    >
                                        <RectangleHorizontal className="w-4 h-4" />
                                    </button>
                                )}

                                {/* Picture-in-Picture */}
                                {pipSupported && (
                                    <button
                                        type="button"
                                        onClick={togglePiP}
                                        title="Picture in Picture"
                                        aria-label="Picture in Picture"
                                        className="hidden sm:inline-flex p-1.5 hover:bg-white/15 rounded text-white/85 transition"
                                    >
                                        <PictureInPicture2 className="w-4 h-4" />
                                    </button>
                                )}

                                {/* Fullscreen */}
                                <button
                                    type="button"
                                    onClick={toggleFullscreen}
                                    title={isFullscreen ? 'Exit full screen (F)' : 'Full screen (F)'}
                                    aria-label="Toggle full screen"
                                    className="p-1.5 hover:bg-white/15 rounded text-white transition"
                                >
                                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Collapsible Side Drawer (Desktop right panel; Mobile full-width tabbed panel below video) */}
                {!theaterMode && (
                    <>
                        {/* Mobile horizontal tab bar */}
                        <div className="flex lg:hidden border-t border-neutral-200 bg-neutral-50 overflow-x-auto">
                            {[
                                { id: 'transcript' as SideTab, label: 'Transcript', icon: FileText },
                                { id: 'readings' as SideTab, label: `Readings (${moduleReadings.length})`, icon: BookOpen },
                                { id: 'notes' as SideTab, label: `Notes (${notes.length})`, icon: BookMarked },
                                { id: 'chapters' as SideTab, label: `Chapters (${chapters.length})`, icon: ListVideo },
                            ].map((t) => {
                                const Icon = t.icon;
                                const active = activeTab === t.id && panelOpen;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveTab(t.id);
                                            setPanelOpen(true);
                                        }}
                                        className={`flex-1 py-2.5 px-2 inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition ${
                                            active
                                                ? 'border-[#030213] text-neutral-950 bg-white'
                                                : 'border-transparent text-neutral-500 hover:text-neutral-900'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5 shrink-0" />
                                        <span>{t.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {panelOpen && (
                            <div className="w-full lg:w-[340px] shrink-0 bg-white text-neutral-950 border-t lg:border-t-0 lg:border-l border-neutral-200 flex flex-col max-h-[380px] lg:max-h-[540px]">
                                {/* Drawer Header */}
                                <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between gap-2 shrink-0">
                                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-900">
                                        {activeTab === 'transcript'
                                            ? 'Transcript'
                                            : activeTab === 'readings'
                                              ? `Module Readings (${moduleReadings.length})`
                                              : activeTab === 'notes'
                                                ? `My Notes (${notes.length})`
                                                : `Chapters (${chapters.length})`}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {activeTab === 'transcript' && cues.length > 0 && (
                                            <label className="inline-flex items-center gap-1 text-[11px] text-neutral-500 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={autoScrollTranscript}
                                                    onChange={(e) => setAutoScrollTranscript(e.target.checked)}
                                                    className="accent-neutral-950"
                                                />
                                                Sync
                                            </label>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setPanelOpen(false)}
                                            aria-label="Close side panel"
                                            className="hidden lg:inline-flex p-1 text-neutral-400 hover:text-neutral-900"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* TAB 1: SYNCED TRANSCRIPT */}
                                {activeTab === 'transcript' && (
                                    <div className="flex-1 flex flex-col min-h-0">
                                        {cues.length > 0 && (
                                            <div className="p-2.5 border-b border-neutral-100 shrink-0">
                                                <div className="relative">
                                                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                    <input
                                                        type="text"
                                                        value={transcriptSearch}
                                                        onChange={(e) => setTranscriptSearch(e.target.value)}
                                                        placeholder="Search transcript..."
                                                        className="w-full bg-neutral-50 border border-neutral-200 pl-8 pr-2.5 py-1.5 text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-left">
                                            {transcriptStatus === 'loading' ? (
                                                <p className="text-xs text-neutral-500 py-6 text-center">Loading transcript...</p>
                                            ) : filteredCues.length === 0 ? (
                                                <div className="py-6 px-3 text-left space-y-2">
                                                    <p className="text-xs font-semibold text-neutral-800">
                                                        {cues.length === 0
                                                            ? 'Transcript not yet uploaded for this video.'
                                                            : 'No matching lines found.'}
                                                    </p>
                                                    {cues.length === 0 && (
                                                        <p className="text-xs text-neutral-500 leading-relaxed">
                                                            Use the <strong>Chapters</strong> tab to navigate video sections or{' '}
                                                            <strong>Notes</strong> to save timestamped takeaways while watching.
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                filteredCues.map((cue) => {
                                                    const isActive = activeCue?.id === cue.id;
                                                    return (
                                                        <button
                                                            key={cue.id}
                                                            ref={isActive ? activeCueRef : undefined}
                                                            type="button"
                                                            onClick={() => seekToTime(cue.start)}
                                                            className={`w-full text-left px-2.5 py-2 text-xs leading-relaxed transition rounded ${
                                                                isActive
                                                                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                                                                    : 'text-neutral-700 hover:bg-neutral-100'
                                                            }`}
                                                        >
                                                            <span
                                                                className={`font-mono text-[10px] mr-2 ${
                                                                    isActive ? 'text-blue-100' : 'text-neutral-400'
                                                                }`}
                                                            >
                                                                {formatDuration(cue.start)}
                                                            </span>
                                                            <span>{cue.text}</span>
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: PERSONAL TIMESTAMPED NOTES */}
                                {activeTab === 'notes' && (
                                    <div className="flex-1 flex flex-col min-h-0">
                                        <form onSubmit={handleAddNote} className="p-3 border-b border-neutral-200 space-y-2 shrink-0">
                                            <div className="flex items-center justify-between text-[11px] text-neutral-500">
                                                <span>Capture note at current time</span>
                                                <span className="font-mono font-semibold text-neutral-900">
                                                    {formatDuration(currentTime)}
                                                </span>
                                            </div>
                                            <textarea
                                                ref={noteInputRef}
                                                rows={2}
                                                maxLength={500}
                                                value={noteDraft}
                                                onChange={(e) => setNoteDraft(e.target.value)}
                                                placeholder="Write a quick note for this moment..."
                                                className="w-full bg-neutral-50 border border-neutral-300 px-2.5 py-2 text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                            />
                                            <button
                                                type="submit"
                                                disabled={savingNote || !noteDraft.trim()}
                                                className="w-full py-2 px-3 bg-[#030213] hover:bg-neutral-800 disabled:opacity-50 text-white text-[11px] font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-1.5"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                {savingNote ? 'Saving...' : 'Save Timestamped Note'}
                                            </button>
                                        </form>
                                        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-left">
                                            {notes.length === 0 ? (
                                                <p className="text-xs text-neutral-500 py-4 leading-relaxed">
                                                    No notes saved for this video yet. Save timestamped notes above and click any timestamp to jump straight back to that moment.
                                                </p>
                                            ) : (
                                                notes.map((n) => (
                                                    <div
                                                        key={n.id}
                                                        className="p-2.5 bg-neutral-50 border border-neutral-200 space-y-1.5"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => seekToTime(n.timeSeconds)}
                                                                className="font-mono text-[11px] font-bold text-blue-700 hover:underline"
                                                            >
                                                                {formatDuration(n.timeSeconds)}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteNote(n.id)}
                                                                aria-label="Delete note"
                                                                className="text-neutral-400 hover:text-red-600 p-0.5"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                        <p className="text-xs text-neutral-800 leading-relaxed break-words">{n.text}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* TAB 3: CHAPTERS */}
                                {activeTab === 'chapters' && (
                                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-left">
                                        {chapters.length === 0 ? (
                                            <p className="text-xs text-neutral-500 py-4">
                                                No chapter markers are listed for this video.
                                            </p>
                                        ) : (
                                            chapters.map((ch, idx) => {
                                                const isCurrent = activeChapter?.startSec === ch.startSec && activeChapter?.title === ch.title;
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => seekToTime(ch.startSec)}
                                                        className={`w-full text-left px-3 py-2.5 border transition flex items-start gap-2.5 ${
                                                            isCurrent
                                                                ? 'bg-[#030213] text-white border-[#030213]'
                                                                : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-900 border-neutral-200'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`font-mono text-[11px] shrink-0 mt-0.5 ${
                                                                isCurrent ? 'text-blue-300 font-bold' : 'text-neutral-500'
                                                            }`}
                                                        >
                                                            {formatDuration(ch.startSec)}
                                                        </span>
                                                        <span className="text-xs leading-snug break-words">{ch.title}</span>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                                {/* TAB 4: MODULE SUPPORTING READINGS (FILES) */}
                                {activeTab === 'readings' && (
                                    <div className="flex-1 overflow-y-auto p-3 space-y-2 text-left">
                                        {moduleReadings.length === 0 ? (
                                            <p className="text-xs text-neutral-500 py-4 leading-relaxed">
                                                No supporting readings are attached to this module.
                                            </p>
                                        ) : (
                                            <>
                                                <p className="text-[11px] text-neutral-500 leading-relaxed pb-1">
                                                    All supporting readings for this module are unlocked alongside the video. Open in a new tab to read while watching.
                                                </p>
                                                {moduleReadings.map((r) => (
                                                    <div
                                                        key={r.id}
                                                        className="p-2.5 bg-neutral-50 border border-neutral-200 hover:border-neutral-400 transition flex items-start justify-between gap-2"
                                                    >
                                                        <Link to={`/lesson/${r.id}`} className="min-w-0 flex-1 space-y-0.5">
                                                            <div className="text-xs font-medium text-neutral-950 hover:underline leading-snug break-words flex items-start gap-1.5">
                                                                {r.completed ? (
                                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                                                ) : (
                                                                    <BookOpen className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                                                                )}
                                                                <span>{r.title}</span>
                                                            </div>
                                                            <div className="text-[10px] text-neutral-500 pl-5">
                                                                {r.estimated_minutes} min read{r.completed ? ' · Completed' : ''}
                                                            </div>
                                                        </Link>
                                                        <Link
                                                            to={`/lesson/${r.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title="Open reading in new tab"
                                                            aria-label={`Open ${r.title} in new tab`}
                                                            className="p-1 text-neutral-400 hover:text-neutral-950 shrink-0"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </Link>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Desktop Far-Right Coursera-Style Vertical Icon Rail */}
                        <div className="hidden lg:flex flex-col items-center gap-1.5 py-3 px-1.5 bg-[#0a0a14] border-l border-white/10 w-14 shrink-0">
                            {[
                                { id: 'transcript' as SideTab, label: 'Transcript', icon: FileText },
                                { id: 'readings' as SideTab, label: 'Readings', icon: BookOpen },
                                { id: 'notes' as SideTab, label: 'Notes', icon: BookMarked },
                                { id: 'chapters' as SideTab, label: 'Chapters', icon: ListVideo },
                            ].map((item) => {
                                const Icon = item.icon;
                                const isActive = panelOpen && activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => openRailTab(item.id)}
                                        className={`w-full py-2 px-1 flex flex-col items-center gap-1 rounded transition ${
                                            isActive
                                                ? 'bg-white/15 text-white'
                                                : 'text-neutral-400 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="text-[9px] font-medium leading-none">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
