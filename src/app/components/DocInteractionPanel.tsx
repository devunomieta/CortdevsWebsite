import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    MessageSquare,
    Send,
    ThumbsUp,
    CornerDownRight,
    AlertTriangle,
    CheckCircle2,
    Clock,
    User,
    MoreHorizontal
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { format } from "date-fns";

interface Comment {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    parent_id: string | null;
    profiles: { full_name: string; role: string };
    replies?: Comment[];
}

interface InteractionPanelProps {
    doc: { id: string; title: string };
    isOpen: boolean;
    onClose: () => void;
    user: any;
    role: string;
    mode: 'comments' | 'issue';
}

export function DocInteractionPanel({ doc, isOpen, onClose, user, role, mode }: InteractionPanelProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [replyTo, setReplyTo] = useState<Comment | null>(null);
    const [issueTitle, setIssueTitle] = useState("");
    const [issueDesc, setIssueDesc] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen && mode === 'comments') {
            fetchComments();
        }
    }, [isOpen, mode, doc.id]);

    const fetchComments = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('doc_comments')
            .select(`
                *,
                profiles (full_name, role)
            `)
            .eq('doc_id', doc.id)
            .order('created_at', { ascending: true });

        if (data) {
            const rootComments = data.filter((c: any) => !c.parent_id);
            const replies = data.filter((c: any) => c.parent_id);
            setComments(rootComments.map((rc: any) => ({
                ...rc,
                replies: replies.filter((r: any) => r.parent_id === rc.id)
            })));
        }
        setIsLoading(false);
    };

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setIsSubmitting(true);
        const { error } = await supabase
            .from('doc_comments')
            .insert([{
                doc_id: doc.id,
                user_id: user.id,
                content: newComment,
                parent_id: replyTo?.id || null
            }]);

        if (!error) {
            setNewComment("");
            setReplyTo(null);
            fetchComments();
        }
        setIsSubmitting(false);
    };

    const handleReportIssue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!issueTitle.trim() || !issueDesc.trim()) return;

        setIsSubmitting(true);
        const { error } = await supabase
            .from('portal_issues')
            .insert([{
                doc_id: doc.id,
                user_id: user.id,
                title: issueTitle,
                description: issueDesc,
                status: 'Open'
            }]);

        if (!error) {
            setIssueTitle("");
            setIssueDesc("");
            onClose();
        }
        setIsSubmitting(false);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex justify-end">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="relative w-full max-w-lg bg-white h-screen shadow-2xl flex flex-col pt-24"
                >
                    <button onClick={onClose} className="absolute top-8 right-8 text-neutral-400 hover:text-black transition-colors">
                        <X size={24} />
                    </button>

                    <div className="px-8 pb-8 border-b border-neutral-100">
                        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-neutral-400 block mb-2">
                            {mode === 'comments' ? 'Dossier Discussion' : 'Technical Intelligence Alert'}
                        </span>
                        <h2 className="text-2xl font-light leading-tight italic">{doc.title}</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {mode === 'comments' ? (
                            <div className="space-y-10 pb-20">
                                {isLoading ? (
                                    <div className="space-y-8">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="animate-pulse flex gap-4">
                                                <div className="w-10 h-10 bg-neutral-100 rounded-full"></div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-2 w-24 bg-neutral-100"></div>
                                                    <div className="h-2 w-full bg-neutral-100"></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : comments.length > 0 ? (
                                    comments.map((comment) => (
                                        <div key={comment.id} className="group">
                                            <div className="flex gap-4 mb-4">
                                                <div className="w-10 h-10 bg-neutral-100 flex items-center justify-center text-neutral-400">
                                                    <User size={18} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider">{comment.profiles.full_name}</span>
                                                        <span className="text-[9px] bg-neutral-900 text-white px-1.5 font-bold uppercase tracking-tighter">{comment.profiles.role}</span>
                                                        <span className="text-[9px] text-neutral-400 ml-auto">{format(new Date(comment.created_at), 'HH:mm • MMM dd')}</span>
                                                    </div>
                                                    <p className="text-xs text-neutral-600 leading-relaxed font-light">{comment.content}</p>
                                                    <button
                                                        onClick={() => setReplyTo(comment)}
                                                        className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mt-3 hover:text-black flex items-center gap-1.5"
                                                    >
                                                        <MessageSquare size={10} /> Reply
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Replies */}
                                            {comment.replies && comment.replies.length > 0 && (
                                                <div className="ml-14 mt-4 space-y-6 border-l border-neutral-100 pl-6">
                                                    {comment.replies.map(reply => (
                                                        <div key={reply.id} className="flex gap-4">
                                                            <div className="w-8 h-8 bg-neutral-50 flex items-center justify-center text-neutral-300">
                                                                <User size={14} />
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-[10px] font-bold tracking-tight uppercase">{reply.profiles.full_name}</span>
                                                                    <span className="text-[9px] text-neutral-400">{format(new Date(reply.created_at), 'MMM dd')}</span>
                                                                </div>
                                                                <p className="text-xs text-neutral-500 font-light italic leading-relaxed">{reply.content}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-20 bg-neutral-50 border border-neutral-100">
                                        <MessageSquare size={32} className="mx-auto text-neutral-200 mb-4" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">No signals detected yet</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-10">
                                <p className="text-xs text-neutral-500 leading-relaxed font-light bg-red-50 p-6 border-l-4 border-red-500 italic">
                                    Alert the Command Center of any data inconsistencies, outdated intel, or technical failures within this dossier.
                                </p>

                                <form onSubmit={handleReportIssue} className="space-y-8 pt-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Incident Header</label>
                                        <input
                                            required
                                            value={issueTitle}
                                            onChange={(e) => setIssueTitle(e.target.value)}
                                            placeholder="Brief summary of the issue..."
                                            className="w-full bg-neutral-50 border border-neutral-200 p-4 text-xs font-medium focus:border-red-500 focus:outline-none transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Dossier Details</label>
                                        <textarea
                                            required
                                            rows={6}
                                            value={issueDesc}
                                            onChange={(e) => setIssueDesc(e.target.value)}
                                            placeholder="Provide detailed intelligence on the error..."
                                            className="w-full bg-neutral-50 border border-neutral-200 p-4 text-xs font-medium focus:border-red-500 focus:outline-none transition-colors resize-none"
                                        />
                                    </div>
                                    <button
                                        disabled={isSubmitting}
                                        className="w-full py-5 bg-black text-white text-[10px] font-bold uppercase tracking-[0.4em] hover:bg-red-600 transition-all flex items-center justify-center gap-3"
                                    >
                                        {isSubmitting ? "INITIATING ALERT..." : "TRANSMIT ISSUE REPORT"}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>

                    {mode === 'comments' && (
                        <div className="p-8 border-t border-neutral-100 bg-neutral-50">
                            {replyTo && (
                                <div className="mb-4 flex items-center justify-between bg-black text-white p-3 text-[9px] font-bold uppercase tracking-widest">
                                    <div className="flex items-center gap-3">
                                        <CornerDownRight size={14} /> Replying to {replyTo.profiles.full_name}
                                    </div>
                                    <button onClick={() => setReplyTo(null)}><X size={14} /></button>
                                </div>
                            )}
                            <form onSubmit={handleComment} className="flex gap-4">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Enter transmission..."
                                    className="flex-1 bg-white border border-neutral-200 px-4 py-4 text-xs font-medium focus:border-black focus:outline-none"
                                />
                                <button
                                    disabled={!newComment.trim() || isSubmitting}
                                    className="w-14 h-14 bg-black text-white flex items-center justify-center hover:bg-neutral-800 transition-all disabled:opacity-50"
                                >
                                    <Send size={20} />
                                </button>
                            </form>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
