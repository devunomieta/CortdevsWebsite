import React, { useEffect, useRef, useState } from 'react';
import {
    Bot,
    CheckCircle2,
    Loader2,
    Lock,
    MessageSquare,
    RotateCcw,
    Send,
    Sparkles,
    ThumbsUp,
    Users,
    X,
} from 'lucide-react';
import { learnApi } from '../lib/api';

export interface DialogueScenarioData {
    title: string;
    roleplayPersona: string;
    personaRole: string;
    scenarioPrompt: string;
    openingMessage: string;
    guidingQuestions: string[];
    standupDebateHook: string;
}

interface CoachTurn {
    role: 'assistant' | 'user';
    text: string;
    isDebrief?: boolean;
}

export function ModuleDialogueModal({
    open,
    onClose,
    moduleId,
    moduleTitle,
    scenario,
    dialoguePosts,
    aiCoachConfigured,
    currentUserId,
    isAdmin,
    onPostCreated,
    onHelpfulToggled,
}: {
    open: boolean;
    onClose: () => void;
    moduleId: string;
    moduleTitle: string;
    scenario: DialogueScenarioData;
    dialoguePosts: any[];
    aiCoachConfigured: boolean;
    currentUserId?: string;
    isAdmin: boolean;
    onPostCreated: (post: any) => void;
    onHelpfulToggled: (commentId: string, count: number, viewerMarked: boolean) => void;
}) {
    const [mode, setMode] = useState<'cohort' | 'ai'>('cohort');

    // Cohort Scenario Dialogue state
    const [cohortDraft, setCohortDraft] = useState('');
    const [postingCohort, setPostingCohort] = useState(false);
    const [replyingId, setReplyingId] = useState<string | null>(null);
    const [replyDraft, setReplyDraft] = useState('');
    const [cohortError, setCohortError] = useState<string | null>(null);

    // AI Stakeholder Coach state
    const [turns, setTurns] = useState<CoachTurn[]>([]);
    const [aiInput, setAiInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiTurnCount, setAiTurnCount] = useState(0);
    const [aiCompleted, setAiCompleted] = useState(false);
    const [aiAvailable, setAiAvailable] = useState(aiCoachConfigured);
    const [sharedDebrief, setSharedDebrief] = useState(false);
    const chatBottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setAiAvailable(aiCoachConfigured);
    }, [aiCoachConfigured]);

    useEffect(() => {
        if (open) {
            setCohortError(null);
            setAiError(null);
            if (turns.length === 0) {
                setTurns([{ role: 'assistant', text: scenario.openingMessage }]);
            }
        }
    }, [open, scenario.openingMessage, turns.length]);

    // Reset AI conversation when switching modules
    useEffect(() => {
        setTurns([{ role: 'assistant', text: scenario.openingMessage }]);
        setAiTurnCount(0);
        setAiCompleted(false);
        setSharedDebrief(false);
        setAiInput('');
        setAiError(null);
    }, [moduleId, scenario.openingMessage]);

    useEffect(() => {
        if (mode === 'ai') {
            chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [turns, mode]);

    if (!open) return null;

    const topPosts = dialoguePosts.filter((p) => !p.parent_id);
    const viewerHasPosted = Boolean(
        isAdmin || (currentUserId && topPosts.some((p) => p.user_id === currentUserId)),
    );

    const handlePostCohortResponse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (cohortDraft.trim().length < 10) {
            setCohortError('Write at least a short response (10+ characters) to share with your cohort.');
            return;
        }
        setPostingCohort(true);
        setCohortError(null);
        try {
            const res = await learnApi('lms/discussions', {
                method: 'POST',
                body: {
                    moduleId,
                    postType: 'dialogue',
                    body: cohortDraft.trim(),
                },
            });
            onPostCreated(res.comment);
            setCohortDraft('');
        } catch (err: any) {
            setCohortError(err?.message || 'Could not post dialogue response.');
        } finally {
            setPostingCohort(false);
        }
    };

    const handlePostCohortReply = async (e: React.FormEvent, parentId: string) => {
        e.preventDefault();
        if (replyDraft.trim().length < 3) return;
        setPostingCohort(true);
        setCohortError(null);
        try {
            const res = await learnApi('lms/discussions', {
                method: 'POST',
                body: {
                    moduleId,
                    parentId,
                    postType: 'dialogue',
                    body: replyDraft.trim(),
                },
            });
            onPostCreated(res.comment);
            setReplyDraft('');
            setReplyingId(null);
        } catch (err: any) {
            setCohortError(err?.message || 'Could not post reply.');
        } finally {
            setPostingCohort(false);
        }
    };

    const handleToggleHelpful = async (commentId: string) => {
        try {
            const res = await learnApi('lms/discussions', {
                method: 'PATCH',
                body: { action: 'toggle_helpful', commentId },
            });
            onHelpfulToggled(commentId, res.helpful_count, res.viewer_marked_helpful);
        } catch (err: any) {
            setCohortError(err?.message || 'Could not update reaction.');
        }
    };

    const handleSendAiTurn = async (e: React.FormEvent) => {
        e.preventDefault();
        const clean = aiInput.trim();
        if (clean.length < 5 || aiLoading || aiCompleted) return;
        setAiLoading(true);
        setAiError(null);

        const priorHistory = turns.map((t) => ({ role: t.role, text: t.text }));
        setTurns((prev) => [...prev, { role: 'user', text: clean }]);
        setAiInput('');

        try {
            const res = await learnApi('lms/dialogue-coach', {
                method: 'POST',
                body: {
                    moduleId,
                    history: priorHistory,
                    userMessage: clean,
                },
            });
            if (res.aiConfigured === false) {
                setAiAvailable(false);
                setAiError(res.error || 'AI Coach is not configured yet.');
                return;
            }
            setTurns((prev) => [
                ...prev,
                { role: 'assistant', text: res.reply, isDebrief: Boolean(res.isFinalDebrief) },
            ]);
            setAiTurnCount(res.turn || aiTurnCount + 1);
            if (res.isFinalDebrief) {
                setAiCompleted(true);
            }
        } catch (err: any) {
            setAiError(err?.message || 'Could not reach AI Coach. Try again or use Cohort Scenario.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleShareAiInsightToCohort = async () => {
        const userMessages = turns.filter((t) => t.role === 'user').map((t) => t.text);
        const lastUserPoint = userMessages[userMessages.length - 1] || '';
        const debriefText = turns.find((t) => t.isDebrief)?.text || '';
        const combined = `My takeaway after practicing with ${scenario.roleplayPersona}:\n${lastUserPoint}${debriefText ? `\n\nCoach Note:\n${debriefText}` : ''}`.slice(0, 1900);

        setPostingCohort(true);
        setCohortError(null);
        try {
            const res = await learnApi('lms/discussions', {
                method: 'POST',
                body: {
                    moduleId,
                    postType: 'dialogue',
                    body: combined,
                },
            });
            onPostCreated(res.comment);
            setSharedDebrief(true);
            setMode('cohort');
        } catch (err: any) {
            setAiError(err?.message || 'Could not share insight to cohort.');
        } finally {
            setPostingCohort(false);
        }
    };

    const handleResetAi = () => {
        setTurns([{ role: 'assistant', text: scenario.openingMessage }]);
        setAiTurnCount(0);
        setAiCompleted(false);
        setSharedDebrief(false);
        setAiError(null);
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6"
        >
            <div className="bg-white border border-neutral-300 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl text-left">
                {/* Calm Focused Header */}
                <div className="px-5 sm:px-6 py-4 border-b border-neutral-200 flex items-start justify-between gap-3 shrink-0">
                    <div className="min-w-0 space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
                            Module Dialogue · Optional Practice · {moduleTitle}
                        </div>
                        <h2 className="text-lg sm:text-xl font-semibold text-neutral-950 leading-snug">
                            {scenario.title}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close dialogue"
                        className="p-1.5 border border-neutral-300 hover:border-neutral-950 text-neutral-700 shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Clean 2-Mode Switcher: Cohort Scenario | AI Stakeholder Coach */}
                <div className="px-5 sm:px-6 pt-3 bg-neutral-50 border-b border-neutral-200 flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setMode('cohort')}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] border-b-2 transition ${
                            mode === 'cohort'
                                ? 'border-[#030213] text-neutral-950 bg-white'
                                : 'border-transparent text-neutral-500 hover:text-neutral-900'
                        }`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Cohort Scenario ({topPosts.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('ai')}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] border-b-2 transition ${
                            mode === 'ai'
                                ? 'border-[#030213] text-neutral-950 bg-white'
                                : 'border-transparent text-neutral-500 hover:text-neutral-900'
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Coach
                    </button>
                </div>

                {/* MODE 1: COHORT SCENARIO DIALOGUE */}
                {mode === 'cohort' && (
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                        {/* Scenario Card */}
                        <div className="p-4 sm:p-5 bg-neutral-50 border border-neutral-200 space-y-3">
                            <p className="text-sm text-neutral-800 leading-relaxed">{scenario.scenarioPrompt}</p>
                            {scenario.guidingQuestions.length > 0 && (
                                <ul className="list-disc pl-5 space-y-1 text-xs text-neutral-600">
                                    {scenario.guidingQuestions.map((gq, i) => (
                                        <li key={i}>{gq}</li>
                                    ))}
                                </ul>
                            )}
                            <div className="pt-2 border-t border-neutral-200 text-[11px] text-neutral-500">
                                <strong className="text-neutral-800">Sunday Standup Hook:</strong> {scenario.standupDebateHook}
                            </div>
                        </div>

                        {cohortError && (
                            <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700">{cohortError}</div>
                        )}

                        {/* Response Composer */}
                        <form onSubmit={handlePostCohortResponse} className="space-y-2.5">
                            <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-900">
                                Your PM Approach (2–4 sentences)
                            </label>
                            <textarea
                                rows={3}
                                value={cohortDraft}
                                onChange={(e) => setCohortDraft(e.target.value)}
                                placeholder="How would you handle this stakeholder conversation or trade-off?"
                                className="w-full bg-white border border-neutral-300 p-3 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] text-neutral-500">
                                    Optional · Feeds directly into Sunday Standup discussions
                                </span>
                                <button
                                    type="submit"
                                    disabled={postingCohort || cohortDraft.trim().length < 10}
                                    className="px-4 py-2 bg-[#030213] hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center gap-1.5"
                                >
                                    {postingCohort ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    Post Response
                                </button>
                            </div>
                        </form>

                        {/* Post-to-Reveal Teammate Approaches */}
                        <div className="space-y-3 pt-2 border-t border-neutral-200">
                            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-700">
                                Teammates’ Approaches ({topPosts.length})
                            </div>

                            {!viewerHasPosted && topPosts.length > 0 ? (
                                <div className="p-4 bg-neutral-50 border border-dashed border-neutral-300 flex items-center gap-3 text-xs text-neutral-600">
                                    <Lock className="w-4 h-4 text-neutral-500 shrink-0" />
                                    <span>
                                        Post your own approach above to unlock and compare{' '}
                                        <strong>{topPosts.length}</strong> teammate{' '}
                                        {topPosts.length === 1 ? 'response' : 'responses'}.
                                    </span>
                                </div>
                            ) : topPosts.length === 0 ? (
                                <p className="text-xs text-neutral-500">
                                    No cohort responses on this module yet — be the first to kick off Sunday’s debate!
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {topPosts.map((post) => {
                                        const replies = dialoguePosts.filter((r) => r.parent_id === post.id);
                                        return (
                                            <div key={post.id} className="p-3.5 bg-neutral-50 border border-neutral-200 space-y-2.5">
                                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                                    <div className="flex items-center gap-1.5 font-semibold text-neutral-950">
                                                        <span>{post.author_name}</span>
                                                        {post.author_group && (
                                                            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-white border border-neutral-300 text-neutral-600">
                                                                {post.author_group}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-neutral-400">
                                                        {new Date(post.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-neutral-800 whitespace-pre-wrap leading-relaxed">
                                                    {post.body}
                                                </p>

                                                <div className="flex items-center gap-3 text-[11px]">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleHelpful(post.id)}
                                                        className={`inline-flex items-center gap-1 font-semibold transition ${
                                                            post.viewer_marked_helpful
                                                                ? 'text-blue-700'
                                                                : 'text-neutral-500 hover:text-neutral-950'
                                                        }`}
                                                    >
                                                        <ThumbsUp className="w-3 h-3" />
                                                        Insightful{post.helpful_count > 0 ? ` (${post.helpful_count})` : ''}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setReplyingId(replyingId === post.id ? null : post.id);
                                                            setReplyDraft('');
                                                        }}
                                                        className="inline-flex items-center gap-1 font-semibold text-neutral-500 hover:text-neutral-950"
                                                    >
                                                        <MessageSquare className="w-3 h-3" />
                                                        {replyingId === post.id
                                                            ? 'Cancel'
                                                            : `Reply${replies.length ? ` (${replies.length})` : ''}`}
                                                    </button>
                                                </div>

                                                {replies.length > 0 && (
                                                    <div className="pl-3 border-l-2 border-neutral-200 space-y-1.5">
                                                        {replies.map((r) => (
                                                            <div key={r.id} className="bg-white border border-neutral-200 p-2 text-[11px] space-y-0.5">
                                                                <span className="font-semibold text-neutral-900">{r.author_name}</span>
                                                                <p className="text-neutral-700 whitespace-pre-wrap">{r.body}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {replyingId === post.id && (
                                                    <form onSubmit={(e) => handlePostCohortReply(e, post.id)} className="flex gap-1.5">
                                                        <input
                                                            type="text"
                                                            value={replyDraft}
                                                            onChange={(e) => setReplyDraft(e.target.value)}
                                                            placeholder="Add a brief counter-point or question..."
                                                            className="flex-1 bg-white border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                                        />
                                                        <button
                                                            type="submit"
                                                            disabled={postingCohort || replyDraft.trim().length < 3}
                                                            className="px-3 py-1.5 bg-[#030213] text-white text-xs font-semibold disabled:opacity-40"
                                                        >
                                                            Reply
                                                        </button>
                                                    </form>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* MODE 2: INTERACTIVE AI STAKEHOLDER COACH */}
                {mode === 'ai' && (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="px-5 sm:px-6 py-2.5 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                            <div className="flex items-center gap-2">
                                <Bot className="w-4 h-4 text-neutral-900" />
                                <span className="font-semibold text-neutral-950">{scenario.roleplayPersona}</span>
                                <span className="text-neutral-500">· {scenario.personaRole}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] text-neutral-500">
                                    Turn {Math.min(aiTurnCount, 4)}/4
                                </span>
                                {aiTurnCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleResetAi}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-600 hover:text-neutral-950"
                                    >
                                        <RotateCcw className="w-3 h-3" /> Restart
                                    </button>
                                )}
                            </div>
                        </div>

                        {!aiAvailable ? (
                            <div className="p-6 sm:p-8 text-center space-y-4">
                                <div className="w-12 h-12 bg-neutral-100 border border-neutral-200 flex items-center justify-center mx-auto">
                                    <Sparkles className="w-5 h-5 text-neutral-700" />
                                </div>
                                <div className="space-y-1 max-w-md mx-auto">
                                    <h3 className="text-sm font-semibold text-neutral-950">
                                        AI Coach Ready to Activate
                                    </h3>
                                    <p className="text-xs text-neutral-600 leading-relaxed">
                                        Add a free-tier <code className="px-1 py-0.5 bg-neutral-100 border border-neutral-200">GEMINI_API_KEY</code> in your environment to enable 4-turn interactive AI roleplay. Meanwhile, you can practice with your teammates in <strong>Cohort Scenario</strong>!
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setMode('cohort')}
                                    className="px-4 py-2 bg-[#030213] text-white text-xs font-bold uppercase tracking-[0.14em]"
                                >
                                    Switch to Cohort Scenario
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3.5">
                                    {turns.map((t, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] p-3.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                                                    t.isDebrief
                                                        ? 'bg-emerald-50 border border-emerald-300 text-emerald-950 w-full max-w-none'
                                                        : t.role === 'user'
                                                          ? 'bg-[#030213] text-white'
                                                          : 'bg-neutral-100 border border-neutral-200 text-neutral-900'
                                                }`}
                                            >
                                                {t.isDebrief && (
                                                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800 mb-1.5 flex items-center gap-1.5">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> PM Coach Debrief
                                                    </div>
                                                )}
                                                {t.text}
                                            </div>
                                        </div>
                                    ))}
                                    {aiLoading && (
                                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>{scenario.roleplayPersona} is responding...</span>
                                        </div>
                                    )}
                                    {aiError && (
                                        <div className="p-2.5 bg-red-50 border border-red-200 text-xs text-red-700">{aiError}</div>
                                    )}
                                    <div ref={chatBottomRef} />
                                </div>

                                <div className="p-4 border-t border-neutral-200 bg-neutral-50 shrink-0">
                                    {aiCompleted ? (
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-xs text-emerald-800 font-medium">
                                                Dialogue complete! Share your insight with the cohort for Sunday Standup.
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleResetAi}
                                                    className="px-3 py-2 bg-white border border-neutral-300 hover:border-neutral-950 text-xs font-semibold text-neutral-800"
                                                >
                                                    Practice Again
                                                </button>
                                                {!sharedDebrief && (
                                                    <button
                                                        type="button"
                                                        disabled={postingCohort}
                                                        onClick={handleShareAiInsightToCohort}
                                                        className="px-4 py-2 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.14em]"
                                                    >
                                                        {postingCohort ? 'Sharing...' : 'Share to Cohort'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSendAiTurn} className="space-y-1.5">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={aiInput}
                                                    onChange={(e) => setAiInput(e.target.value)}
                                                    placeholder={`Reply to ${scenario.roleplayPersona}...`}
                                                    className="flex-1 bg-white border border-neutral-300 px-3 py-2.5 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={aiLoading || aiInput.trim().length < 5}
                                                    className="px-4 py-2.5 bg-[#030213] hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center gap-1.5"
                                                >
                                                    <Send className="w-3.5 h-3.5" /> Send
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-neutral-400">
                                                AI roleplay is powered by Gemini for practice — don’t share confidential client secrets.
                                            </p>
                                        </form>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
