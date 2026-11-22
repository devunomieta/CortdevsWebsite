import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronDown,
    ChevronUp,
    Headphones,
    ListTree,
    Loader2,
    Pause,
    Play,
    SkipBack,
    SkipForward,
    Square,
    Volume2,
} from 'lucide-react';
import { learnApi } from '../lib/api';
import { prepareReadingContent } from '../lib/sessionTimer';

type FontSizeKey = 'sm' | 'md' | 'lg';
type TtsEngine = 'cloud' | 'browser';

const FONT_SIZE_KEY = 'cortdevs_reading_font_size';
const TTS_RATE_KEY = 'cortdevs_reading_tts_rate';
const TTS_RATES = [0.85, 1, 1.25, 1.5, 1.75];

const CLOUD_ACCENTS = [
    { id: 'cloud:en', label: 'Cloud Voice (US)' },
    { id: 'cloud:en-GB', label: 'Cloud Voice (UK)' },
    { id: 'cloud:en-AU', label: 'Cloud Voice (AU)' },
];

function pickBestLocalEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (!voices.length) return null;
    // Strongly prefer localService voices first so privacy browsers (e.g. Brave) don't fail on blocked remote TTS
    const localEn = voices.filter((v) => v.localService && v.lang.toLowerCase().startsWith('en'));
    const allEn = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    const pool = localEn.length ? localEn : allEn.length ? allEn : voices;

    const preferredPatterns = [/natural/i, /samantha/i, /daniel/i, /karen/i, /aria/i, /jenny/i, /english/i];
    for (const pattern of preferredPatterns) {
        const hit = pool.find((v) => pattern.test(v.name));
        if (hit) return hit;
    }
    return pool.find((v) => v.default) || pool[0];
}

export function ReadingViewer({
    html,
    lessonKey,
    compact = false,
    scrollPct,
    onListeningProgress,
}: {
    html: string;
    lessonKey?: string;
    compact?: boolean;
    scrollPct?: number;
    onListeningProgress?: (pct: number) => void;
}) {
    const articleRef = useRef<HTMLElement | null>(null);
    const speechSessionRef = useRef<number>(0);
    const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const activeAudioRef = useRef<HTMLAudioElement | null>(null);
    const audioCacheRef = useRef<Map<string, string>>(new Map());
    const pendingFetchesRef = useRef<Map<string, Promise<string>>>(new Map());
    const onListeningProgressRef = useRef(onListeningProgress);
    onListeningProgressRef.current = onListeningProgress;

    const prepared = useMemo(() => prepareReadingContent(html || '<p>No reading content found.</p>'), [html]);

    // Reading font size preference
    const [fontSize, setFontSize] = useState<FontSizeKey>(() => {
        if (typeof window === 'undefined') return 'md';
        const saved = window.localStorage.getItem(FONT_SIZE_KEY);
        return saved === 'sm' || saved === 'md' || saved === 'lg' ? saved : 'md';
    });

    // Section outline toggle
    const [outlineOpen, setOutlineOpen] = useState(false);

    // Hybrid TTS state (Browser speechSynthesis + automatic Cloud Audio fallback via /api/lms/tts)
    const browserTtsSupported =
        typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
    const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceOption, setSelectedVoiceOption] = useState<string>('cloud:en');
    const [ttsRate, setTtsRate] = useState<number>(() => {
        if (typeof window === 'undefined') return 1;
        const saved = Number(window.localStorage.getItem(TTS_RATE_KEY) || '1');
        return TTS_RATES.includes(saved) ? saved : 1;
    });
    const [ttsState, setTtsState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');
    const [activeBlockIdx, setActiveBlockIdx] = useState<number>(-1);
    const [ttsError, setTtsError] = useState<string | null>(null);

    const handleSetFontSize = (next: FontSizeKey) => {
        setFontSize(next);
        try {
            window.localStorage.setItem(FONT_SIZE_KEY, next);
        } catch {
            // ignore storage errors
        }
    };

    const stopAllPlayback = useCallback(() => {
        speechSessionRef.current += 1;
        activeUtteranceRef.current = null;
        if (activeAudioRef.current) {
            try {
                activeAudioRef.current.pause();
                activeAudioRef.current.src = '';
            } catch {
                // ignore
            }
            activeAudioRef.current = null;
        }
        if (browserTtsSupported) {
            try {
                if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                    window.speechSynthesis.cancel();
                }
            } catch {
                // ignore
            }
        }
        setTtsState('idle');
        setActiveBlockIdx(-1);
        setTtsError(null);
    }, [browserTtsSupported]);

    // Load available browser TTS voices (Chrome loads voices asynchronously via voiceschanged)
    useEffect(() => {
        if (!browserTtsSupported) return;
        const syncVoices = () => {
            const list = window.speechSynthesis.getVoices();
            if (!list.length) return;
            const en = list.filter((v) => v.lang.toLowerCase().startsWith('en'));
            const displayList = en.length ? en : list;
            setBrowserVoices(displayList);
            // Keep Cloud Voice as reliable default if user hasn't picked one, OR pick a local OS voice if present
            setSelectedVoiceOption((prev) => {
                if (prev && (prev.startsWith('cloud:') || displayList.some((v) => `browser:${v.voiceURI}` === prev))) {
                    return prev;
                }
                const bestLocal = pickBestLocalEnglishVoice(displayList);
                return bestLocal && bestLocal.localService ? `browser:${bestLocal.voiceURI}` : 'cloud:en';
            });
        };
        syncVoices();
        window.speechSynthesis.addEventListener?.('voiceschanged', syncVoices);
        return () => {
            window.speechSynthesis.removeEventListener?.('voiceschanged', syncVoices);
        };
    }, [browserTtsSupported]);

    // Cancel playback & clear cache cleanly on lesson change or unmount
    useEffect(() => {
        stopAllPlayback();
        audioCacheRef.current.clear();
        pendingFetchesRef.current.clear();
        setOutlineOpen(false);
    }, [lessonKey, stopAllPlayback]);

    useEffect(() => {
        return () => {
            speechSessionRef.current += 1;
            if (activeAudioRef.current) {
                try {
                    activeAudioRef.current.pause();
                    activeAudioRef.current.src = '';
                } catch {
                    // ignore
                }
            }
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                try {
                    window.speechSynthesis.cancel();
                } catch {
                    // ignore
                }
            }
        };
    }, []);

    // Highlight active TTS paragraph in the rendered DOM & scroll smoothly into view
    useEffect(() => {
        const root = articleRef.current;
        if (!root) return;
        root.querySelectorAll('[data-tts-active="true"]').forEach((el) => el.removeAttribute('data-tts-active'));
        if (activeBlockIdx < 0) return;
        const target = root.querySelector(`[data-tts-idx="${activeBlockIdx}"]`) as HTMLElement | null;
        if (target) {
            target.setAttribute('data-tts-active', 'true');
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [activeBlockIdx, prepared.html]);

    const fetchCloudAudioDataUrl = useCallback(async (blockIdx: number, text: string, lang: string): Promise<string> => {
        const cacheKey = `${lang}:${blockIdx}`;
        const cached = audioCacheRef.current.get(cacheKey);
        if (cached) return cached;

        const inflight = pendingFetchesRef.current.get(cacheKey);
        if (inflight) return inflight;

        const reqPromise = learnApi('lms/tts', {
            method: 'POST',
            body: { text, lang },
        })
            .then((res) => {
                if (!res?.audioBase64) throw new Error('Audio response was empty.');
                const dataUrl = `data:${res.mimeType || 'audio/mpeg'};base64,${res.audioBase64}`;
                audioCacheRef.current.set(cacheKey, dataUrl);
                return dataUrl;
            })
            .finally(() => {
                pendingFetchesRef.current.delete(cacheKey);
            });

        pendingFetchesRef.current.set(cacheKey, reqPromise);
        return reqPromise;
    }, []);

    const speakFromIndex = useCallback(
        (startIdx: number, rateOverride?: number, voiceOptOverride?: string, forceEngine?: TtsEngine) => {
            if (!prepared.ttsBlocks.length) return;
            const bounded = Math.max(0, Math.min(prepared.ttsBlocks.length - 1, startIdx));
            const session = ++speechSessionRef.current;
            const rateToUse = rateOverride ?? ttsRate;
            const voiceOpt = voiceOptOverride ?? selectedVoiceOption;

            setTtsError(null);

            // Stop any active HTMLAudio element cleanly
            if (activeAudioRef.current) {
                try {
                    activeAudioRef.current.pause();
                    activeAudioRef.current.src = '';
                } catch {
                    // ignore
                }
                activeAudioRef.current = null;
            }

            // Decide engine: Cloud Audio (works universally on every browser/OS) or Browser speechSynthesis
            const useBrowser =
                forceEngine === 'browser' ||
                (forceEngine !== 'cloud' &&
                    voiceOpt.startsWith('browser:') &&
                    browserTtsSupported &&
                    browserVoices.length > 0);

            const cloudLang = voiceOpt.startsWith('cloud:') ? voiceOpt.slice('cloud:'.length) : 'en';

            const playCloudBlock = async (idx: number) => {
                if (speechSessionRef.current !== session) return;
                if (idx >= prepared.ttsBlocks.length) {
                    setTtsState('idle');
                    setActiveBlockIdx(-1);
                    onListeningProgressRef.current?.(100);
                    return;
                }

                const block = prepared.ttsBlocks[idx];
                setActiveBlockIdx(idx);
                const pct = Math.min(100, Math.round(((idx + 1) / prepared.ttsBlocks.length) * 100));
                onListeningProgressRef.current?.(pct);

                const cacheKey = `${cloudLang}:${idx}`;
                if (!audioCacheRef.current.has(cacheKey)) {
                    setTtsState('loading');
                }

                try {
                    const dataUrl = await fetchCloudAudioDataUrl(idx, block.text, cloudLang);
                    if (speechSessionRef.current !== session) return;

                    // Pre-fetch next block in the background for gapless transitions
                    if (idx + 1 < prepared.ttsBlocks.length) {
                        fetchCloudAudioDataUrl(idx + 1, prepared.ttsBlocks[idx + 1].text, cloudLang).catch(() => {});
                    }

                    const audio = new Audio(dataUrl);
                    audio.playbackRate = rateToUse;
                    activeAudioRef.current = audio;

                    audio.onended = () => {
                        if (speechSessionRef.current !== session) return;
                        playCloudBlock(idx + 1);
                    };
                    audio.onerror = () => {
                        if (speechSessionRef.current !== session) return;
                        setTtsState('idle');
                        setActiveBlockIdx(-1);
                        setTtsError('Audio playback failed in this browser.');
                    };

                    setTtsState('playing');
                    await audio.play();
                } catch (err: any) {
                    if (speechSessionRef.current !== session) return;
                    setTtsState('idle');
                    setActiveBlockIdx(-1);
                    setTtsError(err?.message || 'Unable to load audio voice right now. Please try again.');
                }
            };

            const playBrowserBlock = (idx: number) => {
                if (speechSessionRef.current !== session) return;
                if (idx >= prepared.ttsBlocks.length) {
                    setTtsState('idle');
                    setActiveBlockIdx(-1);
                    onListeningProgressRef.current?.(100);
                    return;
                }

                const block = prepared.ttsBlocks[idx];
                setActiveBlockIdx(idx);
                setTtsState('playing');
                const pct = Math.min(100, Math.round(((idx + 1) / prepared.ttsBlocks.length) * 100));
                onListeningProgressRef.current?.(pct);

                const targetUri = voiceOpt.startsWith('browser:') ? voiceOpt.slice('browser:'.length) : '';
                const voiceObj =
                    browserVoices.find((v) => v.voiceURI === targetUri) || pickBestLocalEnglishVoice(browserVoices);

                const utterance = new window.SpeechSynthesisUtterance(block.text);
                utterance.rate = rateToUse;
                if (voiceObj) {
                    utterance.voice = voiceObj;
                    utterance.lang = voiceObj.lang || 'en-US';
                } else {
                    utterance.lang = 'en-US';
                }

                // Pin ref to prevent Chromium GC from silently dropping onend mid-sentence
                activeUtteranceRef.current = utterance;

                let started = false;
                const fallbackToCloud = () => {
                    if (speechSessionRef.current !== session) return;
                    try {
                        window.speechSynthesis.cancel();
                    } catch {
                        // ignore
                    }
                    setSelectedVoiceOption('cloud:en');
                    playCloudBlock(idx);
                };

                // Watchdog: if browser speech engine silently ignores speak() without starting, auto-fallback to Cloud Audio
                const watchdog = window.setTimeout(() => {
                    if (!started && speechSessionRef.current === session && !window.speechSynthesis.speaking) {
                        fallbackToCloud();
                    }
                }, 1400);

                utterance.onstart = () => {
                    started = true;
                    window.clearTimeout(watchdog);
                };
                utterance.onend = () => {
                    window.clearTimeout(watchdog);
                    if (speechSessionRef.current !== session) return;
                    playBrowserBlock(idx + 1);
                };
                utterance.onerror = (ev) => {
                    window.clearTimeout(watchdog);
                    if (speechSessionRef.current !== session) return;
                    if (ev.error === 'canceled' || ev.error === 'interrupted') return;
                    // Auto-fallback to Cloud Audio seamlessly on Linux/Brave or blocked remote voices
                    fallbackToCloud();
                };

                window.speechSynthesis.speak(utterance);
            };

            if (useBrowser) {
                const needsCancel = browserTtsSupported && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
                if (needsCancel) {
                    try {
                        window.speechSynthesis.cancel();
                    } catch {
                        // ignore
                    }
                    // Wait 60ms after cancel() so Chromium doesn't abort the new utterance on the same tick
                    window.setTimeout(() => playBrowserBlock(bounded), 60);
                } else {
                    playBrowserBlock(bounded);
                }
            } else {
                if (browserTtsSupported && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
                    try {
                        window.speechSynthesis.cancel();
                    } catch {
                        // ignore
                    }
                }
                playCloudBlock(bounded);
            }
        },
        [prepared.ttsBlocks, ttsRate, selectedVoiceOption, browserTtsSupported, browserVoices, fetchCloudAudioDataUrl],
    );

    const handleTogglePlayPause = () => {
        if (!prepared.ttsBlocks.length) return;
        if (ttsState === 'playing' || ttsState === 'loading') {
            speechSessionRef.current += 1;
            if (activeAudioRef.current) {
                try {
                    activeAudioRef.current.pause();
                } catch {
                    // ignore
                }
            }
            if (browserTtsSupported) {
                try {
                    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                        window.speechSynthesis.cancel();
                    }
                } catch {
                    // ignore
                }
            }
            setTtsState('paused');
        } else if (ttsState === 'paused') {
            // If Cloud audio element is paused mid-paragraph, resume right where it paused!
            if (activeAudioRef.current && activeAudioRef.current.src && activeAudioRef.current.currentTime > 0 && !activeAudioRef.current.ended) {
                const resumeSession = ++speechSessionRef.current;
                const audio = activeAudioRef.current;
                audio.playbackRate = ttsRate;
                const currentIdx = Math.max(0, activeBlockIdx);
                audio.onended = () => {
                    if (speechSessionRef.current !== resumeSession) return;
                    speakFromIndex(currentIdx + 1);
                };
                setTtsState('playing');
                audio.play().catch(() => speakFromIndex(currentIdx));
            } else {
                speakFromIndex(Math.max(0, activeBlockIdx));
            }
        } else {
            speakFromIndex(0);
        }
    };

    const handleChangeRate = (nextRate: number) => {
        setTtsRate(nextRate);
        try {
            window.localStorage.setItem(TTS_RATE_KEY, String(nextRate));
        } catch {
            // ignore
        }
        // Live speed adjustment on HTML5 Cloud Audio without restarting the sentence!
        if (activeAudioRef.current && ttsState === 'playing') {
            activeAudioRef.current.playbackRate = nextRate;
        } else if (ttsState === 'playing' && activeBlockIdx >= 0) {
            speakFromIndex(activeBlockIdx, nextRate);
        }
    };

    const handleChangeVoice = (nextOpt: string) => {
        setSelectedVoiceOption(nextOpt);
        if (ttsState === 'playing' && activeBlockIdx >= 0) {
            speakFromIndex(activeBlockIdx, undefined, nextOpt);
        }
    };

    const handleArticleClick = (e: React.MouseEvent<HTMLElement>) => {
        if (ttsState === 'idle') return;
        const targetEl = (e.target as HTMLElement | null)?.closest('[data-tts-idx]') as HTMLElement | null;
        if (!targetEl) return;
        if ((e.target as HTMLElement | null)?.closest('a')) return;
        const idx = Number(targetEl.getAttribute('data-tts-idx'));
        if (Number.isFinite(idx) && idx >= 0) {
            speakFromIndex(idx);
        }
    };

    const jumpToHeading = (headingId: string) => {
        const el = articleRef.current?.querySelector(`#${CSS.escape(headingId)}`) as HTMLElement | null;
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setOutlineOpen(false);
        }
    };

    const showOutline = prepared.headings.length >= 2;
    const totalBlocks = prepared.ttsBlocks.length;

    return (
        <div className="relative">
            {/* Subtle top scroll progress bar */}
            {typeof scrollPct === 'number' && !compact && (
                <div className="h-[3px] w-full bg-neutral-100 overflow-hidden">
                    <div
                        className="h-full bg-[#030213] transition-all duration-200"
                        style={{ width: `${Math.min(100, Math.max(0, scrollPct))}%` }}
                    />
                </div>
            )}

            {/* Reading Comfort & Hybrid Text-to-Speech Toolbar */}
            <div
                className={`${
                    compact ? 'px-4 py-2.5' : 'sticky top-0 z-10 px-4 sm:px-6 py-2.5'
                } bg-white/95 backdrop-blur-sm border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2.5`}
            >
                {/* Left: Listen Mode (TTS) Controls */}
                {totalBlocks > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleTogglePlayPause}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition ${
                                ttsState === 'playing' || ttsState === 'loading'
                                    ? 'bg-blue-700 hover:bg-blue-800 text-white'
                                    : 'bg-[#030213] hover:bg-neutral-800 text-white'
                            }`}
                        >
                            {ttsState === 'loading' ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                                </>
                            ) : ttsState === 'playing' ? (
                                <>
                                    <Pause className="w-3.5 h-3.5" /> Pause
                                </>
                            ) : ttsState === 'paused' ? (
                                <>
                                    <Play className="w-3.5 h-3.5 fill-current" /> Resume
                                </>
                            ) : (
                                <>
                                    <Headphones className="w-3.5 h-3.5" /> Listen
                                </>
                            )}
                        </button>

                        {ttsState !== 'idle' && (
                            <>
                                <button
                                    type="button"
                                    disabled={activeBlockIdx <= 0}
                                    onClick={() => speakFromIndex(activeBlockIdx - 1)}
                                    title="Previous paragraph"
                                    aria-label="Previous paragraph"
                                    className="p-1.5 border border-neutral-300 bg-white hover:border-neutral-950 disabled:opacity-35 text-neutral-800"
                                >
                                    <SkipBack className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    disabled={activeBlockIdx >= totalBlocks - 1}
                                    onClick={() => speakFromIndex(activeBlockIdx + 1)}
                                    title="Next paragraph"
                                    aria-label="Next paragraph"
                                    className="p-1.5 border border-neutral-300 bg-white hover:border-neutral-950 disabled:opacity-35 text-neutral-800"
                                >
                                    <SkipForward className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={stopAllPlayback}
                                    title="Stop audio"
                                    aria-label="Stop audio"
                                    className="p-1.5 border border-neutral-300 bg-white hover:border-red-600 hover:text-red-600 text-neutral-700"
                                >
                                    <Square className="w-3.5 h-3.5 fill-current" />
                                </button>
                                <span className="text-[11px] font-mono text-neutral-500 px-1">
                                    {Math.max(1, activeBlockIdx + 1)}/{totalBlocks}
                                </span>
                            </>
                        )}

                        {/* Speed selector */}
                        <select
                            aria-label="Reading voice speed"
                            value={ttsRate}
                            onChange={(e) => handleChangeRate(Number(e.target.value))}
                            className="bg-neutral-50 border border-neutral-300 px-2 py-1 text-[11px] font-semibold text-neutral-800 focus:outline-none focus:border-neutral-950"
                        >
                            {TTS_RATES.map((r) => (
                                <option key={r} value={r}>
                                    {r}x
                                </option>
                            ))}
                        </select>

                        {/* Voice selector (Cloud voices always available + Browser OS voices if present) */}
                        <div className="hidden sm:inline-flex items-center gap-1 bg-neutral-50 border border-neutral-300 px-2 py-1">
                            <Volume2 className="w-3 h-3 text-neutral-500 shrink-0" />
                            <select
                                aria-label="Reading voice"
                                value={selectedVoiceOption}
                                onChange={(e) => handleChangeVoice(e.target.value)}
                                className="bg-transparent text-[11px] text-neutral-700 max-w-[155px] truncate focus:outline-none"
                            >
                                <optgroup label="Cloud Audio (Works Everywhere)">
                                    {CLOUD_ACCENTS.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.label}
                                        </option>
                                    ))}
                                </optgroup>
                                {browserVoices.length > 0 && (
                                    <optgroup label="Device Voices">
                                        {browserVoices.slice(0, 15).map((v) => (
                                            <option key={v.voiceURI} value={`browser:${v.voiceURI}`}>
                                                {v.name.replace(/Microsoft |Google /i, '').slice(0, 26)}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                    </div>
                ) : (
                    <span className="text-[11px] font-medium text-neutral-500">Reading View</span>
                )}

                {/* Right: Section Jump + Font Size Controls */}
                <div className="flex items-center gap-2">
                    {showOutline && (
                        <button
                            type="button"
                            onClick={() => setOutlineOpen((o) => !o)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[11px] font-semibold transition ${
                                outlineOpen
                                    ? 'bg-[#030213] text-white border-[#030213]'
                                    : 'bg-white border-neutral-300 hover:border-neutral-950 text-neutral-800'
                            }`}
                        >
                            <ListTree className="w-3.5 h-3.5" />
                            <span>Sections ({prepared.headings.length})</span>
                            {outlineOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                    )}

                    <div
                        className="inline-flex items-center border border-neutral-300 bg-white divide-x divide-neutral-200"
                        role="group"
                        aria-label="Text size"
                    >
                        {(
                            [
                                { key: 'sm', label: 'A-' },
                                { key: 'md', label: 'A' },
                                { key: 'lg', label: 'A+' },
                            ] as const
                        ).map((opt) => (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() => handleSetFontSize(opt.key)}
                                className={`px-2 py-1 text-[11px] font-bold transition ${
                                    fontSize === opt.key
                                        ? 'bg-[#030213] text-white'
                                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Active TTS helper hint or error banner */}
            {ttsError && (
                <div className="px-4 sm:px-6 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 text-left">
                    {ttsError}
                </div>
            )}
            {ttsState !== 'idle' && !ttsError && (
                <div className="px-4 sm:px-6 py-1.5 bg-blue-50 border-b border-blue-100 text-[11px] text-blue-900 flex items-center justify-between gap-2">
                    <span>
                        {ttsState === 'loading'
                            ? 'Preparing voice audio...'
                            : ttsState === 'playing'
                              ? 'Reading aloud — click any paragraph below to jump narration there.'
                              : 'Audio paused — click Resume or tap any paragraph to continue.'}
                    </span>
                </div>
            )}

            {/* Collapsible Jump-to-Section Outline */}
            {showOutline && outlineOpen && (
                <div className="px-4 sm:px-6 py-3.5 bg-neutral-50 border-b border-neutral-200 space-y-2 text-left">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
                        Jump to Section
                    </div>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                        {prepared.headings.map((h) => (
                            <button
                                key={h.id}
                                type="button"
                                onClick={() => jumpToHeading(h.id)}
                                className={`text-left text-xs py-1 px-2 hover:bg-white hover:text-neutral-950 border border-transparent hover:border-neutral-200 transition truncate ${
                                    h.level >= 3 ? 'pl-5 text-neutral-600' : 'font-medium text-neutral-800'
                                }`}
                            >
                                {h.level >= 3 ? '↳ ' : '• '}
                                {h.text}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Formatted Editorial Reading Body */}
            <div className="overflow-x-auto">
                <article
                    ref={articleRef}
                    onClick={handleArticleClick}
                    className={`learn-reading-prose reading-size-${fontSize} ${
                        ttsState !== 'idle' ? 'tts-interactive' : ''
                    } ${compact ? 'p-4 sm:p-6' : 'p-5 sm:p-8 lg:p-10'} mx-auto text-left`}
                    dangerouslySetInnerHTML={{ __html: prepared.html }}
                />
            </div>
        </div>
    );
}
