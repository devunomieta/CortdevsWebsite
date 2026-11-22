import React, { useState } from 'react';
import {
    Lock,
    MessageSquare,
    MessageSquareQuote,
    Send,
    Sparkles,
    ThumbsUp,
    Users,
} from 'lucide-react';
import { learnApi } from '../lib/api';
import type { DialogueScenarioData } from './ModuleDialogueModal';

type CompanionTab = 'qa' | 'reflect' | 'dialogue';

export interface PeerReflectionItem {
    lessonId?: string;
    lessonTitle?: string;
    userId: string;
    isCurrentUser: boolean;
    authorName: string;
    authorRole: string;
    studyGroup: string | null;
    takeaway: string;
    completedAt: string | null;
}

export interface PeerReflectionsPayload {
    unlocked: boolean;
    totalCount: number;
    items: PeerReflectionItem[];
    moduleTotalCount?: number;
    moduleItems?: PeerReflectionItem[];
    replies: any[];
}

export function LessonCompanionPanel({
    moduleId,
    lessonId,
    isReading,
    isAdmin,
    currentUserId,
    comments,
    setComments,
    dialoguePosts,
    dialogueScenario,
    aiCoachConfigured,
    reflections,
    onOpenDialogue,
    onError,
}: {
    moduleId: string;
    lessonId: string;
    isReading: boolean;
    isAdmin: boolean;
    currentUserId?: string;
    comments: any[];
    setComments: React.Dispatch<React.SetStateAction<any[]>>;
    dialoguePosts: any[];
    dialogueScenario: DialogueScenarioData | null;
    aiCoachConfigured: boolean;
    reflections: PeerReflectionsPayload | null;
    onOpenDialogue: () => void;
    onError: (msg: string) => void;
}) {
    const [tab, setTab] = useState<CompanionTab>('qa');

    // Q&A composer & moderation state
    const [newComment, setNewComment] = useState('');
    const [postingComment, setPostingComment] = useState(false);
    const [replyingToId, setReplyingToId] = useState<string | null>(null);
    const [replyBody, setReplyBody] = useState('');
    const [answeringId, setAnsweringId] = useState<string | null>(null);
    const [officialAnswerDraft, setOfficialAnswerDraft] = useState('');
    const [savingAnswer, setSavingAnswer] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentBody, setEditingCommentBody] = useState('');

    // Reflection peer reply & scope state ('lesson' vs 'module')
    const [notesScope, setNotesScope] = useState<'lesson' | 'module'>(isReading ? 'lesson' : 'module');
    const [reflectReplyDraft, setReflectReplyDraft] = useState('');
    const [localReflectReplies, setLocalReflectReplies] = useState<any[]>([]);
    const [postingReflectReply, setPostingReflectReply] = useState(false);

    const effectiveTab: CompanionTab = tab;
    const effectiveNotesScope: 'lesson' | 'module' = isReading ? notesScope : 'module';
    const moduleNotesCount = reflections?.moduleTotalCount ?? reflections?.totalCount ?? 0;
    const moduleVisibleNotes = reflections?.moduleItems ?? reflections?.items ?? [];

    const topQuestions = comments.filter((c) => !c.parent_id);
    const topDialoguePosts = dialoguePosts.filter((p) => !p.parent_id);
    const allReflectReplies = [
        ...(reflections?.replies || []),
        ...localReflectReplies.filter((lr) => !(reflections?.replies || []).some((r) => r.id === lr.id)),
    ];

    const canModifyPost = (post: any): boolean => {
        if (isAdmin) return true;
        if (!currentUserId || post.user_id !== currentUserId) return false;
        const createdMs = new Date(post.created_at).getTime();
        return Number.isFinite(createdMs) && Date.now() - createdMs <= 15 * 60 * 1000;
    };

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!moduleId || !newComment.trim()) return;
        setPostingComment(true);
        try {
            const res = await learnApi('lms/discussions', {
                method: 'POST',
                body: { moduleId, body: newComment.trim(), postType: 'question' },
            });
            setComments((prev) => [...prev, res.comment]);
            setNewComment('');
        } catch (err: any) {
            onError(err?.message || 'Could not post question.');
        } finally {
            setPostingComment(false);
        }
    };

    const handlePostReply = async (e: React.FormEvent, parentId: string) => {
        e.preventDefault();
        if (!moduleId || !replyBody.trim()) return;
        setPostingComment(true);
        try {
            const res = await learnApi('lms/discussions', {
                method: 'POST',
                body: { moduleId, parentId, body: replyBody.trim(), postType: 'question' },
            });
            setComments((prev) => [...prev, res.comment]);
            setReplyBody('');
            setReplyingToId(null);
        } catch (err: any) {
            onError(err?.message || 'Could not post reply.');
        } finally {
            setPostingComment(false);
        }
    };

    const handleSaveOfficialAnswer = async (questionId: string) => {
        if (!officialAnswerDraft.trim()) return;
        setSavingAnswer(true);
        try {
            const res = await learnApi('lms/discussions', {
                method: 'PATCH',
                body: { questionId, status: 'answered', officialAnswer: officialAnswerDraft.trim() },
            });
            setComments((prev) => prev.map((c) => (c.id === questionId ? { ...c, ...res.comment } : c)));
            setAnsweringId(null);
            setOfficialAnswerDraft('');
        } catch (err: any) {
            onError(err?.message || 'Could not save session answer.');
        } finally {
            setSavingAnswer(false);
        }
    };

    const handleSaveCommentEdit = async (e: React.FormEvent, commentId: string) => {
        e.preventDefault();
        if (editingCommentBody.trim().length < 3) return;
        setPostingComment(true);
        try {
            const res = await learnApi('lms/discussions', {
                method: 'PATCH',
                body: { action: 'edit_body', commentId, body: editingCommentBody.trim() },
            });
            setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, body: res.comment.body } : c)));
            setEditingCommentId(null);
            setEditingCommentBody('');
        } catch (err: any) {
            onError(err?.message || 'Could not edit post.');
        } finally {
            setPostingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!window.confirm('Delete this post?')) return;
        try {
            await learnApi(`lms/discussions?id=${encodeURIComponent(commentId)}`, { method: 'DELETE' });
            setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId));
        } catch (err: any) {
            onError(err?.message || 'Could not delete post.');
        }
    };

    const handleToggleHelpful = async (commentId: string) => {
        try {
            const res = await learnApi('lms/discussions', {
                method: 'PATCH',
                body: { action: 'toggle_helpful', commentId },
            });
            setComments((prev) =>
                prev.map((c) =>
                    c.id === commentId
                        ? { ...c, helpful_count: res.helpful_count, viewer_marked_helpful: res.viewer_marked_helpful }
                        : c,
                ),
            );
        } catch (err: any) {
            onError(err?.message || 'Could not update reaction.');
        }
    };

    const handlePostReflectionReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!moduleId || !lessonId || reflectReplyDraft.trim().length < 3) return;
        setPostingReflectReply(true);
        try {
            const res = await learnApi('lms/discussions', {
                method: 'POST',
                body: {
                    moduleId,
                    lessonId,
                    postType: 'reflection_reply',
                    body: reflectReplyDraft.trim(),
                },
            });
            setLocalReflectReplies((prev) => [...prev, res.comment]);
            setReflectReplyDraft('');
        } catch (err: any) {
            onError(err?.message || 'Could not post reflection comment.');
        } finally {
            setPostingReflectReply(false);
        }
    };

    return (
        <div className="min-w-0 bg-white border border-neutral-200 overflow-hidden">
            {/* Clean 2-or-3 Tab Companion Header (Zero Extra Page Clutter) */}
            <div className="flex border-b border-neutral-200 bg-neutral-50">
                <button
                    type="button"
                    onClick={() => setTab('qa')}
                    className={`flex-1 py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider border-b-2 inline-flex items-center justify-center gap-1 transition ${
                        effectiveTab === 'qa'
                            ? 'border-[#030213] text-neutral-950 bg-white'
                            : 'border-transparent text-neutral-500 hover:text-neutral-900'
                    }`}
                >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span>Q&amp;A{topQuestions.length ? ` (${topQuestions.length})` : ''}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setTab('reflect')}
                    className={`flex-1 py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider border-b-2 inline-flex items-center justify-center gap-1 transition ${
                        effectiveTab === 'reflect'
                            ? 'border-[#030213] text-neutral-950 bg-white'
                            : 'border-transparent text-neutral-500 hover:text-neutral-900'
                    }`}
                >
                    <MessageSquareQuote className="w-3.5 h-3.5 shrink-0" />
                    <span>Notes{moduleNotesCount ? ` (${moduleNotesCount})` : ''}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setTab('dialogue')}
                    className={`flex-1 py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider border-b-2 inline-flex items-center justify-center gap-1 transition ${
                        effectiveTab === 'dialogue'
                            ? 'border-[#030213] text-neutral-950 bg-white'
                            : 'border-transparent text-neutral-500 hover:text-neutral-900'
                    }`}
                >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Dialogue{topDialoguePosts.length ? ` (${topDialoguePosts.length})` : ''}</span>
                </button>
            </div>

            {/* TAB 1: MODULE Q&A & SESSION ANSWERS */}
            {effectiveTab === 'qa' && (
                <div className="p-4 sm:p-5 space-y-4">
                    <p className="text-[11px] text-neutral-500 text-left">
                        Ask questions for Sunday’s team session, reply to help teammates, and see agreed answers once resolved.
                    </p>

                    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                        {topQuestions.length === 0 ? (
                            <p className="text-xs text-neutral-500 py-2 text-left leading-relaxed">
                                No questions asked on this module yet. Drop a question below and we will cover it in the next team session.
                            </p>
                        ) : (
                            topQuestions.map((q) => {
                                const replies = comments.filter((r) => r.parent_id === q.id);
                                const isAnswered = q.status === 'answered';
                                return (
                                    <div key={q.id} className="p-3 bg-neutral-50 border border-neutral-200 space-y-2 text-left">
                                        <div className="flex items-center justify-between gap-2 text-[11px]">
                                            <span className="font-semibold text-neutral-950 truncate">
                                                {q.author_name}
                                                {q.author_role === 'admin' && (
                                                    <span className="ml-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-[#030213] text-white">
                                                        Admin
                                                    </span>
                                                )}
                                            </span>
                                            <span
                                                className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                                                    isAnswered
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}
                                            >
                                                {isAnswered ? 'Answered ✓' : 'For Next Session'}
                                            </span>
                                        </div>

                                        {editingCommentId === q.id ? (
                                            <form onSubmit={(e) => handleSaveCommentEdit(e, q.id)} className="space-y-2">
                                                <textarea
                                                    rows={2}
                                                    value={editingCommentBody}
                                                    onChange={(e) => setEditingCommentBody(e.target.value)}
                                                    className="w-full bg-white border border-neutral-300 p-2 text-base sm:text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        type="submit"
                                                        disabled={postingComment || editingCommentBody.trim().length < 3}
                                                        className="px-2.5 py-1 bg-[#030213] text-white text-[11px] font-semibold disabled:opacity-40"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingCommentId(null)}
                                                        className="px-2.5 py-1 border border-neutral-300 text-[11px] text-neutral-600"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </form>
                                        ) : (
                                            <p className="text-xs text-neutral-800 whitespace-pre-wrap break-words leading-relaxed">
                                                {q.body}
                                            </p>
                                        )}

                                        {isAnswered && q.official_answer && (
                                            <div className="p-2.5 bg-emerald-50 border-l-2 border-emerald-600 text-xs text-emerald-950 space-y-1">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                                    Agreed Session Answer {q.answered_by_name ? `· ${q.answered_by_name}` : ''}
                                                </div>
                                                <p className="whitespace-pre-wrap break-words">{q.official_answer}</p>
                                            </div>
                                        )}

                                        {replies.length > 0 && (
                                            <div className="pl-3 border-l-2 border-neutral-200 space-y-1.5 pt-1">
                                                {replies.map((r) => (
                                                    <div key={r.id} className="text-[11px] bg-white border border-neutral-200 p-2 space-y-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="font-semibold text-neutral-900">{r.author_name}</span>
                                                            {canModifyPost(r) && (
                                                                <div className="inline-flex items-center gap-2 text-[10px]">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setEditingCommentId(r.id);
                                                                            setEditingCommentBody(r.body);
                                                                        }}
                                                                        className="text-neutral-500 hover:text-neutral-950 font-semibold"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteComment(r.id)}
                                                                        className="text-red-600 hover:text-red-800 font-semibold"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {editingCommentId === r.id ? (
                                                            <form onSubmit={(e) => handleSaveCommentEdit(e, r.id)} className="flex gap-1.5">
                                                                <input
                                                                    type="text"
                                                                    value={editingCommentBody}
                                                                    onChange={(e) => setEditingCommentBody(e.target.value)}
                                                                    className="flex-1 bg-neutral-50 border border-neutral-300 px-2 py-1 text-xs text-neutral-950"
                                                                />
                                                                <button
                                                                    type="submit"
                                                                    className="px-2 py-1 bg-[#030213] text-white text-[10px] font-semibold"
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingCommentId(null)}
                                                                    className="px-2 py-1 border border-neutral-300 text-[10px] text-neutral-600"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </form>
                                                        ) : (
                                                            <p className="text-neutral-700 whitespace-pre-wrap break-words">{r.body}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleHelpful(q.id)}
                                                className={`inline-flex items-center gap-1 font-semibold ${
                                                    q.viewer_marked_helpful ? 'text-blue-700' : 'text-neutral-500 hover:text-neutral-950'
                                                }`}
                                            >
                                                <ThumbsUp className="w-3 h-3" />
                                                {q.helpful_count > 0 ? q.helpful_count : 'Helpful'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReplyingToId(replyingToId === q.id ? null : q.id);
                                                    setReplyBody('');
                                                }}
                                                className="font-semibold text-neutral-600 hover:text-neutral-950"
                                            >
                                                {replyingToId === q.id ? 'Cancel Reply' : `Reply${replies.length ? ` (${replies.length})` : ''}`}
                                            </button>
                                            {canModifyPost(q) && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingCommentId(editingCommentId === q.id ? null : q.id);
                                                            setEditingCommentBody(q.body);
                                                        }}
                                                        className="font-semibold text-neutral-500 hover:text-neutral-950"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteComment(q.id)}
                                                        className="font-semibold text-red-600 hover:text-red-800"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                            {isAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAnsweringId(answeringId === q.id ? null : q.id);
                                                        setOfficialAnswerDraft(q.official_answer || '');
                                                    }}
                                                    className="font-semibold text-emerald-700 hover:text-emerald-900"
                                                >
                                                    {answeringId === q.id
                                                        ? 'Cancel'
                                                        : isAnswered
                                                          ? 'Edit Agreed Answer'
                                                          : 'Add Agreed Answer'}
                                                </button>
                                            )}
                                        </div>

                                        {replyingToId === q.id && (
                                            <form onSubmit={(e) => handlePostReply(e, q.id)} className="flex gap-1.5 pt-1">
                                                <input
                                                    type="text"
                                                    value={replyBody}
                                                    onChange={(e) => setReplyBody(e.target.value)}
                                                    placeholder="Write a reply..."
                                                    className="flex-1 bg-white border border-neutral-300 px-2.5 py-1.5 text-base sm:text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={postingComment || !replyBody.trim()}
                                                    className="px-2.5 py-1.5 bg-[#030213] text-white text-xs font-semibold disabled:opacity-40"
                                                >
                                                    Reply
                                                </button>
                                            </form>
                                        )}

                                        {isAdmin && answeringId === q.id && (
                                            <div className="space-y-2 pt-1">
                                                <textarea
                                                    rows={3}
                                                    value={officialAnswerDraft}
                                                    onChange={(e) => setOfficialAnswerDraft(e.target.value)}
                                                    placeholder="Enter the agreed answer from the live team session..."
                                                    className="w-full bg-white border border-neutral-300 p-2 text-base sm:text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={savingAnswer || officialAnswerDraft.trim().length < 5}
                                                    onClick={() => handleSaveOfficialAnswer(q.id)}
                                                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-[11px] font-bold uppercase tracking-wider"
                                                >
                                                    {savingAnswer ? 'Saving...' : 'Save & Mark Answered'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <form onSubmit={handlePostComment} className="flex gap-2 pt-2 border-t border-neutral-200">
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Ask a question for the team session..."
                            className="flex-1 min-w-0 bg-white border border-neutral-300 px-3 py-2 text-base sm:text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                        />
                        <button
                            type="submit"
                            disabled={postingComment || !newComment.trim()}
                            className="px-3 py-2 bg-[#030213] hover:bg-neutral-800 disabled:opacity-40 text-white shrink-0"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </form>
                </div>
            )}

            {/* TAB 2: MODULE-SCOPED TEAM NOTES (POST-TO-REVEAL PER READING + ALL UNLOCKED NOTES IN THIS MODULE) */}
            {effectiveTab === 'reflect' && (
                <div className="p-4 sm:p-5 space-y-4 text-left">
                    <div className="space-y-2">
                        <p className="text-[11px] text-neutral-500 leading-relaxed">
                            Team Notes written strictly inside this module. Notes on unread lessons stay hidden until you share your own takeaway.
                        </p>

                        {isReading && (
                            <div className="inline-flex border border-neutral-200 bg-neutral-50 p-0.5 text-[10px] font-bold uppercase tracking-wider">
                                <button
                                    type="button"
                                    onClick={() => setNotesScope('lesson')}
                                    className={`px-2.5 py-1 transition ${
                                        effectiveNotesScope === 'lesson'
                                            ? 'bg-[#030213] text-white'
                                            : 'text-neutral-600 hover:text-neutral-950'
                                    }`}
                                >
                                    This Reading ({reflections?.totalCount || 0})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNotesScope('module')}
                                    className={`px-2.5 py-1 transition ${
                                        effectiveNotesScope === 'module'
                                            ? 'bg-[#030213] text-white'
                                            : 'text-neutral-600 hover:text-neutral-950'
                                    }`}
                                >
                                    This Module ({moduleNotesCount})
                                </button>
                            </div>
                        )}
                    </div>

                    {effectiveNotesScope === 'lesson' ? (
                        !reflections?.unlocked ? (
                            <div className="p-4 bg-neutral-50 border border-dashed border-neutral-300 space-y-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900">
                                    <Lock className="w-4 h-4 text-neutral-600 shrink-0" />
                                    <span>Post-to-Reveal Team Notes</span>
                                </div>
                                <p className="text-xs text-neutral-600 leading-relaxed">
                                    {reflections && reflections.totalCount > 0
                                        ? `Submit your Key Takeaway below this reading to unlock ${reflections.totalCount} teammate ${
                                              reflections.totalCount === 1 ? 'note' : 'notes'
                                          }.`
                                        : 'Submit your Key Takeaway below this reading to share your note with teammates in this module.'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                                    {reflections.items.length === 0 ? (
                                        <p className="text-xs text-neutral-500">No Team Notes posted on this reading yet.</p>
                                    ) : (
                                        reflections.items.map((item, idx) => (
                                            <div key={idx} className="p-3 bg-neutral-50 border border-neutral-200 space-y-1.5">
                                                <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                                                    <span className="font-semibold text-neutral-950 flex items-center gap-1.5">
                                                        {item.authorName}
                                                        {item.isCurrentUser && (
                                                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-neutral-200 text-neutral-700">
                                                                You
                                                            </span>
                                                        )}
                                                        {item.studyGroup && (
                                                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-white border border-neutral-300 text-neutral-600">
                                                                {item.studyGroup}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-neutral-800 leading-relaxed">“{item.takeaway}”</p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {allReflectReplies.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-neutral-200">
                                        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                                            Peer Discussion ({allReflectReplies.length})
                                        </div>
                                        {allReflectReplies.map((r) => (
                                            <div key={r.id} className="p-2.5 bg-white border border-neutral-200 text-xs space-y-0.5">
                                                <div className="font-semibold text-neutral-900 text-[11px]">{r.author_name}</div>
                                                <p className="text-neutral-700 whitespace-pre-wrap">{r.body}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <form onSubmit={handlePostReflectionReply} className="flex gap-2 pt-2 border-t border-neutral-200">
                                    <input
                                        type="text"
                                        value={reflectReplyDraft}
                                        onChange={(e) => setReflectReplyDraft(e.target.value)}
                                        placeholder="Respond to a teammate's note..."
                                        className="flex-1 min-w-0 bg-white border border-neutral-300 px-3 py-2 text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                    />
                                    <button
                                        type="submit"
                                        disabled={postingReflectReply || reflectReplyDraft.trim().length < 3}
                                        className="px-3 py-2 bg-[#030213] hover:bg-neutral-800 disabled:opacity-40 text-white shrink-0"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                    </button>
                                </form>
                            </>
                        )
                    ) : (
                        <div className="space-y-2.5 max-h-[430px] overflow-y-auto pr-1">
                            {moduleVisibleNotes.length === 0 ? (
                                <div className="p-4 bg-neutral-50 border border-dashed border-neutral-300 space-y-1.5">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900">
                                        <Lock className="w-4 h-4 text-neutral-600 shrink-0" />
                                        <span>Module Team Notes</span>
                                    </div>
                                    <p className="text-xs text-neutral-600 leading-relaxed">
                                        {moduleNotesCount > 0
                                            ? `There ${moduleNotesCount === 1 ? 'is 1 teammate note' : `are ${moduleNotesCount} teammate notes`} in this module. Complete a reading’s Key Takeaway in this module to unlock your cohort’s notes on it.`
                                            : 'No Team Notes have been posted in this module yet. Takeaways from readings and projects in this module appear here.'}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {moduleNotesCount > moduleVisibleNotes.length && (
                                        <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-600">
                                            Showing {moduleVisibleNotes.length} of {moduleNotesCount} notes in this module (complete the remaining readings to unlock the rest).
                                        </div>
                                    )}
                                    {moduleVisibleNotes.map((item, idx) => (
                                        <div key={idx} className="p-3 bg-neutral-50 border border-neutral-200 space-y-1.5">
                                            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                                                <span className="font-semibold text-neutral-950 flex items-center gap-1.5">
                                                    {item.authorName}
                                                    {item.isCurrentUser && (
                                                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-neutral-200 text-neutral-700">
                                                            You
                                                        </span>
                                                    )}
                                                    {item.studyGroup && (
                                                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-white border border-neutral-300 text-neutral-600">
                                                            {item.studyGroup}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="text-[10px] text-neutral-400">
                                                    {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : ''}
                                                </span>
                                            </div>
                                            {item.lessonTitle && (
                                                <div className="text-[10px] font-medium text-neutral-500 break-words">
                                                    {item.lessonTitle}
                                                </div>
                                            )}
                                            <p className="text-xs text-neutral-800 leading-relaxed">“{item.takeaway}”</p>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: MODULE DIALOGUE LAUNCHPAD */}
            {effectiveTab === 'dialogue' && (
                <div className="p-4 sm:p-5 space-y-4 text-left">
                    {dialogueScenario ? (
                        <>
                            <div className="space-y-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                                    Enterprise PM Scenario · Optional
                                </div>
                                <h3 className="text-sm font-semibold text-neutral-950 leading-snug">
                                    {dialogueScenario.title}
                                </h3>
                                <p className="text-xs text-neutral-600 leading-relaxed">
                                    {dialogueScenario.scenarioPrompt}
                                </p>
                            </div>

                            <div className="p-3 bg-neutral-50 border border-neutral-200 space-y-1.5 text-[11px]">
                                <div className="flex items-center justify-between text-neutral-700">
                                    <span className="inline-flex items-center gap-1.5 font-semibold">
                                        <Users className="w-3.5 h-3.5" /> Cohort Responses
                                    </span>
                                    <span className="font-mono font-bold text-neutral-950">{topDialoguePosts.length}</span>
                                </div>
                                <div className="text-neutral-500 leading-relaxed">
                                    <strong className="text-neutral-800">Sunday Standup:</strong>{' '}
                                    {dialogueScenario.standupDebateHook}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={onOpenDialogue}
                                className="w-full py-2.5 px-4 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.16em] inline-flex items-center justify-center gap-2 transition"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Start Module Dialogue
                            </button>

                            <p className="text-[10px] text-neutral-400 text-center">
                                {aiCoachConfigured
                                    ? 'Includes Cohort Scenario Debate + AI Coach (4 turns)'
                                    : 'Practice with Cohort Scenario Debate · Syncs with Sunday Standup'}
                            </p>
                        </>
                    ) : (
                        <p className="text-xs text-neutral-500">Loading module dialogue...</p>
                    )}
                </div>
            )}
        </div>
    );
}
