import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronDown,
    ChevronUp,
    Headphones,
    ListTree,
    Pause,
    Play,
    SkipBack,
    SkipForward,
    Square,
    Volume2,
} from 'lucide-react';
import { prepareReadingContent } from '../lib/sessionTimer';

type FontSizeKey = 'sm' | 'md' | 'lg';

const FONT_SIZE_KEY = 'cortdevs_reading_font_size';
const TTS_RATE_KEY = 'cortdevs_reading_tts_rate';
const TTS_RATES = [0.85, 1, 1.25, 1.5, 1.75];

function pickBestEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (!voices.length) return null;
    const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    const pool = enVoices.length ? enVoices : voices;
    const preferredPatterns = [
        /natural/i,
        /google us english/i,
        /google uk english/i,
        /microsoft.*online/i,
        /samantha/i,
        /daniel/i,
        /karen/i,
        /aria/i,
        /jenny/i,
    ];
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

    const prepared = useMemo(() => prepareReadingContent(html || '<p>No reading content found.</p>'), [html]);

    // Reading font size preference
    const [fontSize, setFontSize] = useState<FontSizeKey>(() => {
        if (typeof window === 'undefined') return 'md';
        const saved = window.localStorage.getItem(FONT_SIZE_KEY);
        return saved === 'sm' || saved === 'md' || saved === 'lg' ? saved : 'md';
    });

    // Section outline toggle
    const [outlineOpen, setOutlineOpen] = useState(false);

    // Text-to-Speech state
    const ttsSupported =
        typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('');
    const [ttsRate, setTtsRate] = useState<number>(() => {
        if (typeof window === 'undefined') return 1;
        const saved = Number(window.localStorage.getItem(TTS_RATE_KEY) || '1');
        return TTS_RATES.includes(saved) ? saved : 1;
    });
    const [ttsState, setTtsState] = useState<'idle' | 'playing' | 'paused'>('idle');
    const [activeBlockIdx, setActiveBlockIdx] = useState<number>(-1);

    const handleSetFontSize = (next: FontSizeKey) => {
        setFontSize(next);
        try {
            window.localStorage.setItem(FONT_SIZE_KEY, next);
        } catch {
            // ignore storage errors
        }
    };

    const stopSpeech = useCallback(() => {
        speechSessionRef.current += 1;
        if (ttsSupported) {
            try {
                window.speechSynthesis.cancel();
            } catch {
                // ignore
            }
        }
        setTtsState('idle');
        setActiveBlockIdx(-1);
    }, [ttsSupported]);

    // Load available browser TTS voices (Chrome loads voices asynchronously via voiceschanged)
    useEffect(() => {
        if (!ttsSupported) return;
        const syncVoices = () => {
            const list = window.speechSynthesis.getVoices();
            if (!list.length) return;
            // Prioritize English voices first, then others
            const en = list.filter((v) => v.lang.toLowerCase().startsWith('en'));
            const displayList = en.length ? en : list;
            setVoices(displayList);
            setSelectedVoiceUri((prev) => {
                if (prev && displayList.some((v) => v.voiceURI === prev)) return prev;
                const best = pickBestEnglishVoice(displayList);
                return best?.voiceURI || displayList[0]?.voiceURI || '';
            });
        };
        syncVoices();
        window.speechSynthesis.addEventListener?.('voiceschanged', syncVoices);
        return () => {
            window.speechSynthesis.removeEventListener?.('voiceschanged', syncVoices);
        };
    }, [ttsSupported]);

    // Always cancel speech cleanly on lesson switch or unmount
    useEffect(() => {
        stopSpeech();
        setOutlineOpen(false);
    }, [lessonKey, stopSpeech]);

    useEffect(() => {
        return () => {
            speechSessionRef.current += 1;
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

    const speakFromIndex = useCallback(
        (startIdx: number, rateOverride?: number, voiceUriOverride?: string) => {
            if (!ttsSupported || !prepared.ttsBlocks.length) return;
            const bounded = Math.max(0, Math.min(prepared.ttsBlocks.length - 1, startIdx));
            const session = ++speechSessionRef.current;
            const rateToUse = rateOverride ?? ttsRate;
            const voiceUri = voiceUriOverride ?? selectedVoiceUri;
            const voiceObj = voices.find((v) => v.voiceURI === voiceUri) || pickBestEnglishVoice(voices);

            try {
                window.speechSynthesis.cancel();
            } catch {
                // ignore
            }

            setTtsState('playing');

            const speakBlock = (idx: number) => {
                if (speechSessionRef.current !== session) return;
                if (idx >= prepared.ttsBlocks.length) {
                    setTtsState('idle');
                    setActiveBlockIdx(-1);
                    onListeningProgress?.(100);
                    return;
                }

                const block = prepared.ttsBlocks[idx];
                setActiveBlockIdx(idx);
                const pct = Math.min(100, Math.round(((idx + 1) / prepared.ttsBlocks.length) * 100));
                onListeningProgress?.(pct);

                const utterance = new window.SpeechSynthesisUtterance(block.text);
                utterance.rate = rateToUse;
                if (voiceObj) utterance.voice = voiceObj;
                utterance.lang = voiceObj?.lang || 'en-US';

                utterance.onend = () => {
                    if (speechSessionRef.current !== session) return;
                    speakBlock(idx + 1);
                };
                utterance.onerror = (ev) => {
                    if (speechSessionRef.current !== session) return;
                    // Ignore intentional cancel/interrupted errors
                    if (ev.error === 'canceled' || ev.error === 'interrupted') return;
                    setTtsState('idle');
                    setActiveBlockIdx(-1);
                };

                window.speechSynthesis.speak(utterance);
            };

            speakBlock(bounded);
        },
        [ttsSupported, prepared.ttsBlocks, ttsRate, selectedVoiceUri, voices, onListeningProgress],
    );

    const handleTogglePlayPause = () => {
        if (!ttsSupported || !prepared.ttsBlocks.length) return;
        if (ttsState === 'playing') {
            // Cancel & retain current block index for rock-solid pause/resume across all browsers
            speechSessionRef.current += 1;
            try {
                window.speechSynthesis.cancel();
            } catch {
                // ignore
            }
            setTtsState('paused');
        } else if (ttsState === 'paused') {
            speakFromIndex(Math.max(0, activeBlockIdx));
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
        if (ttsState === 'playing' && activeBlockIdx >= 0) {
            speakFromIndex(activeBlockIdx, nextRate);
        }
    };

    const handleChangeVoice = (nextUri: string) => {
        setSelectedVoiceUri(nextUri);
        if (ttsState === 'playing' && activeBlockIdx >= 0) {
            speakFromIndex(activeBlockIdx, undefined, nextUri);
        }
    };

    const handleArticleClick = (e: React.MouseEvent<HTMLElement>) => {
        if (!ttsSupported || ttsState === 'idle') return;
        const targetEl = (e.target as HTMLElement | null)?.closest('[data-tts-idx]') as HTMLElement | null;
        if (!targetEl) return;
        // Do not hijack link clicks
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

            {/* Reading Comfort & Text-to-Speech Toolbar */}
            <div
                className={`${
                    compact ? 'px-4 py-2.5' : 'sticky top-0 z-10 px-4 sm:px-6 py-2.5'
                } bg-white/95 backdrop-blur-sm border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2.5`}
            >
                {/* Left: Listen Mode (TTS) Controls */}
                {ttsSupported && totalBlocks > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleTogglePlayPause}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition ${
                                ttsState === 'playing'
                                    ? 'bg-blue-700 hover:bg-blue-800 text-white'
                                    : 'bg-[#030213] hover:bg-neutral-800 text-white'
                            }`}
                        >
                            {ttsState === 'playing' ? (
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
                                    onClick={stopSpeech}
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

                        {/* Voice selector (shown on sm+ when multiple voices exist) */}
                        {voices.length > 1 && (
                            <div className="hidden sm:inline-flex items-center gap-1 bg-neutral-50 border border-neutral-300 px-2 py-1">
                                <Volume2 className="w-3 h-3 text-neutral-500 shrink-0" />
                                <select
                                    aria-label="Reading voice"
                                    value={selectedVoiceUri}
                                    onChange={(e) => handleChangeVoice(e.target.value)}
                                    className="bg-transparent text-[11px] text-neutral-700 max-w-[140px] truncate focus:outline-none"
                                >
                                    {voices.slice(0, 20).map((v) => (
                                        <option key={v.voiceURI} value={v.voiceURI}>
                                            {v.name.replace(/Microsoft |Google /i, '').slice(0, 28)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
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

            {/* Active TTS helper hint */}
            {ttsState !== 'idle' && (
                <div className="px-4 sm:px-6 py-1.5 bg-blue-50 border-b border-blue-100 text-[11px] text-blue-900 flex items-center justify-between gap-2">
                    <span>
                        {ttsState === 'playing'
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
