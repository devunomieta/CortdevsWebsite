import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    AlertCircle,
    CheckCircle2,
    MessageSquare,
    Clock,
    Filter,
    User,
    ArrowRight,
    Search,
    RefreshCw,
    X,
    Inbox
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { format } from "date-fns";

interface Issue {
    id: string;
    title: string;
    description: string;
    status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
    created_at: string;
    user_id: string;
    doc_id: string;
    documentation: { title: string };
    profiles: { full_name: string; email: string };
    messages?: { content: string; profiles: { full_name: string } }[];
}

export function AdminIssueManagement() {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<string>("All");
    const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
    const [adminReply, setAdminReply] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchIssues();
    }, []);

    const fetchIssues = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('portal_issues')
            .select(`
                *,
                documentation(title),
                profiles(full_name, email)
            `)
            .order('created_at', { ascending: false });

        if (data) setIssues(data);
        setIsLoading(false);
    };

    const updateStatus = async (id: string, status: string) => {
        const { error } = await supabase
            .from('portal_issues')
            .update({ status })
            .eq('id', id);

        if (!error) {
            fetchIssues();
            if (selectedIssue?.id === id) {
                setSelectedIssue({ ...selectedIssue, status: status as any });
            }
        }
    };

    const handleAdminReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminReply.trim() || !selectedIssue) return;

        setIsSubmitting(true);
        const { data: { session } } = await supabase.auth.getSession();

        const { error } = await supabase
            .from('issue_messages')
            .insert([{
                issue_id: selectedIssue.id,
                user_id: session?.user.id,
                content: adminReply,
                is_internal: false
            }]);

        if (!error) {
            setAdminReply("");
            // Refresh logic for messages would go here
        }
        setIsSubmitting(false);
    };

    const filteredIssues = issues.filter(i => filter === "All" || i.status === filter);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-light italic mb-2">Issue <span className="font-bold not-italic">Reporting Console</span></h1>
                    <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-neutral-400">Moderating Documentation Integrity</p>
                </div>

                <div className="flex gap-2">
                    {["All", "Open", "In Progress", "Resolved"].map((s) => (
                        <button
                            key={s}
                            onClick={() => setFilter(s)}
                            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${filter === s ? "bg-black text-white border-black" : "bg-white text-neutral-400 border-neutral-200 hover:border-black hover:text-black"
                                }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white border border-neutral-200 flex flex-col h-[700px]">
                    <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Incident Feed</span>
                        <button onClick={fetchIssues} className="text-neutral-400 hover:text-black"><RefreshCw size={14} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {isLoading ? (
                            <div className="p-12 text-center animate-pulse space-y-4">
                                <div className="h-8 bg-neutral-100 w-full"></div>
                                <div className="h-8 bg-neutral-100 w-full"></div>
                                <div className="h-8 bg-neutral-100 w-full"></div>
                            </div>
                        ) : filteredIssues.length > 0 ? (
                            filteredIssues.map((issue) => (
                                <motion.div
                                    key={issue.id}
                                    layoutId={issue.id}
                                    onClick={() => setSelectedIssue(issue)}
                                    className={`p-6 border-b border-neutral-50 cursor-pointer transition-all hover:bg-neutral-50 group ${selectedIssue?.id === issue.id ? "bg-neutral-50 border-l-4 border-l-black" : ""
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`text-[9px] font-bold px-2 py-0.5 uppercase tracking-tighter ${issue.status === 'Open' ? 'bg-red-900 text-white' :
                                            issue.status === 'In Progress' ? 'bg-orange-500 text-white' :
                                                'bg-green-600 text-white'
                                            }`}>
                                            {issue.status}
                                        </span>
                                        <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest">{format(new Date(issue.created_at), 'MMM dd')}</span>
                                    </div>
                                    <h3 className="text-sm font-bold mb-1 truncate">{issue.title}</h3>
                                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-4">{issue.documentation?.title}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                                        <User size={12} /> {issue.profiles?.full_name}
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-neutral-300">
                                <Inbox size={48} strokeWidth={1} className="mb-4" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">No issues reported</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white border border-neutral-200 h-[700px] flex flex-col relative">
                    <AnimatePresence mode="wait">
                        {selectedIssue ? (
                            <motion.div
                                key={selectedIssue.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex-1 flex flex-col h-full"
                            >
                                <div className="p-8 border-b border-neutral-100 bg-neutral-900 text-white">
                                    <div className="flex justify-between items-start mb-6">
                                        <button
                                            onClick={() => updateStatus(selectedIssue.id, 'Resolved')}
                                            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${selectedIssue.status === 'Resolved' ? 'bg-green-600 text-white' : 'bg-white text-black hover:bg-green-500 hover:text-white'}`}
                                        >
                                            {selectedIssue.status === 'Resolved' ? '✓ Resolved' : 'Mark Resolved'}
                                        </button>
                                        <div className="flex gap-2">
                                            <select
                                                value={selectedIssue.status}
                                                onChange={(e) => updateStatus(selectedIssue.id, e.target.value)}
                                                className="bg-white/10 border border-white/20 text-[9px] font-bold uppercase px-3 py-1 focus:outline-none"
                                            >
                                                <option value="Open">Open</option>
                                                <option value="In Progress">In Progress</option>
                                                <option value="Resolved">Resolved</option>
                                                <option value="Closed">Closed</option>
                                            </select>
                                        </div>
                                    </div>
                                    <h2 className="text-2xl font-light italic mb-2">{selectedIssue.title}</h2>
                                    <p className="text-[10px] text-neutral-400 uppercase tracking-[0.3em] font-bold">Reported by {selectedIssue.profiles?.full_name}</p>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                                    <div className="bg-neutral-50 p-6 border-l-4 border-black italic font-light text-sm text-neutral-600 leading-relaxed">
                                        "{selectedIssue.description}"
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4 text-neutral-300">
                                            <div className="h-px bg-neutral-100 flex-1"></div>
                                            <span className="text-[9px] font-bold uppercase tracking-widest">Follow-up Inquiry</span>
                                            <div className="h-px bg-neutral-100 flex-1"></div>
                                        </div>

                                        <form onSubmit={handleAdminReply} className="space-y-4">
                                            <textarea
                                                rows={4}
                                                value={adminReply}
                                                onChange={(e) => setAdminReply(e.target.value)}
                                                placeholder="Request more intel..."
                                                className="w-full bg-neutral-50 border border-neutral-200 p-4 text-xs font-medium focus:border-black focus:outline-none resize-none"
                                            />
                                            <button
                                                disabled={!adminReply.trim() || isSubmitting}
                                                className="w-full py-4 bg-black text-white text-[10px] font-bold uppercase tracking-[0.4em] hover:bg-neutral-800 transition-all flex items-center justify-center gap-3"
                                            >
                                                {isSubmitting ? "TRANSMITTING..." : "SEND INQUIRY"}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-neutral-300">
                                <AlertCircle size={64} strokeWidth={1} className="mb-6" />
                                <h3 className="text-xl font-light italic text-neutral-400">Select an incident to begin moderation</h3>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
