import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Download,
    Trash2,
    CheckCircle2,
    FileText,
    User,
    Clock,
    AlertCircle,
    Check
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { format } from "date-fns";

interface Submission {
    id: string;
    title: string;
    category: string;
    file_url: string;
    submitted_by: string;
    status: string;
    created_at: string;
    profiles: {
        full_name: string;
        email: string;
    };
}

export function AdminSubmissions() {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved'>('Pending');

    useEffect(() => {
        fetchSubmissions();
    }, []);

    const fetchSubmissions = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('documentation_submissions')
                .select(`
                    *,
                    profiles:submitted_by (
                        full_name,
                        email
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setSubmissions(data);
        } catch (err) {
            console.error("Error fetching submissions:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const updateStatus = async (id: string, status: string) => {
        try {
            const { error } = await supabase
                .from('documentation_submissions')
                .update({ status })
                .eq('id', id);

            if (error) throw error;
            fetchSubmissions();
        } catch (err) {
            console.error("Error updating submission status:", err);
        }
    };

    const deleteSubmission = async (id: string) => {
        if (!confirm("Are you sure you want to discard this submission?")) return;
        try {
            const { error } = await supabase
                .from('documentation_submissions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchSubmissions();
        } catch (err) {
            console.error("Error deleting submission:", err);
        }
    };

    const filteredSubmissions = submissions.filter(s => filter === 'All' || s.status === filter);

    return (
        <div className="space-y-8 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-light italic tracking-tight mb-1">Intel <span className="font-bold not-italic">Submissions</span></h2>
                    <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-neutral-400">Review staff-contributed assets</p>
                </div>
                <div className="flex bg-neutral-100 p-1">
                    {(['Pending', 'Approved', 'All'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${filter === f ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-black'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="py-20 flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-black border-t-transparent animate-spin rounded-full"></div>
                    <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Retrieving Submissions...</p>
                </div>
            ) : filteredSubmissions.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                    {filteredSubmissions.map((sub) => (
                        <motion.div
                            key={sub.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white border border-neutral-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-lg transition-all group"
                        >
                            <div className="flex items-center gap-6 w-full md:w-auto">
                                <div className={`w-12 h-12 flex items-center justify-center ${sub.status === 'Approved' ? 'bg-green-50 text-green-600' : 'bg-neutral-100 text-neutral-400'} group-hover:bg-black group-hover:text-white transition-colors`}>
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-1 block">{sub.category}</span>
                                    <h3 className="text-lg font-medium">{sub.title}</h3>
                                    <div className="flex items-center gap-4 mt-2 text-neutral-400">
                                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                                            <User size={12} /> {sub.profiles?.full_name || 'Unknown User'}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                                            <Clock size={12} /> {format(new Date(sub.created_at), 'MMM dd, HH:mm')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-neutral-100">
                                <a
                                    href={sub.file_url}
                                    target="_blank"
                                    className="p-3 bg-neutral-100 text-neutral-600 hover:bg-black hover:text-white transition-all order-1 md:order-none"
                                    title="Download Asset"
                                >
                                    <Download size={18} />
                                </a>

                                {sub.status === 'Pending' && (
                                    <button
                                        onClick={() => updateStatus(sub.id, 'Approved')}
                                        className="flex-1 md:flex-none px-6 py-3 bg-neutral-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Check size={14} /> Approve
                                    </button>
                                )}

                                <button
                                    onClick={() => deleteSubmission(sub.id)}
                                    className="p-3 text-neutral-300 hover:text-red-500 transition-all"
                                    title="Discard Submission"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="py-40 text-center border-2 border-dashed border-neutral-100">
                    <AlertCircle size={48} className="mx-auto text-neutral-200 mb-4" />
                    <p className="text-neutral-400 font-light italic">No {filter.toLowerCase()} submissions in the queue.</p>
                </div>
            )}
        </div>
    );
}
