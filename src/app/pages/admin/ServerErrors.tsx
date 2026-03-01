import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../lib/supabase";
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Search,
    Filter,
    ChevronRight,
    Code,
    RefreshCw,
    Trash2,
    X
} from "lucide-react";
import { format } from "date-fns";

interface ServerError {
    id: string;
    location: string;
    message: string;
    stack: string;
    details: any;
    fix_suggestion: string;
    status: 'Unresolved' | 'Investigating' | 'Resolved';
    created_at: string;
}

export function ServerErrors() {
    const [errors, setErrors] = useState<ServerError[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedError, setSelectedError] = useState<ServerError | null>(null);
    const [filter, setFilter] = useState<'All' | 'Unresolved' | 'Investigating' | 'Resolved'>('Unresolved');

    useEffect(() => {
        fetchErrors();
    }, [filter]);

    const fetchErrors = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('server_errors')
                .select('*')
                .order('created_at', { ascending: false });

            if (filter !== 'All') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query;
            if (error) throw error;
            setErrors(data || []);
        } catch (err) {
            console.error("Failed to fetch error logs:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const updateStatus = async (id: string, status: ServerError['status']) => {
        try {
            const { error } = await supabase
                .from('server_errors')
                .update({ status })
                .eq('id', id);
            if (error) throw error;
            fetchErrors();
            if (selectedError?.id === id) {
                setSelectedError(prev => prev ? { ...prev, status } : null);
            }
        } catch (err) {
            console.error("Failed to update status:", err);
        }
    };

    const deleteError = async (id: string) => {
        try {
            const { error } = await supabase
                .from('server_errors')
                .delete()
                .eq('id', id);
            if (error) throw error;
            fetchErrors();
            if (selectedError?.id === id) setSelectedError(null);
        } catch (err) {
            console.error("Failed to purge error log:", err);
        }
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-4xl font-light tracking-tight italic mb-2">Error Intelligence</h2>
                    <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest flex items-center gap-2">
                        <AlertTriangle size={12} className="text-red-500" /> System-Wide Anomaly Surveillance
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-neutral-100 p-1">
                    {(['All', 'Unresolved', 'Investigating', 'Resolved'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all ${filter === f ? "bg-black text-white" : "text-neutral-500 hover:text-black"
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                    <button onClick={fetchErrors} className="p-2 hover:bg-neutral-200 transition-colors">
                        <RefreshCw size={14} className={isLoading ? "animate-spin text-neutral-400" : "text-neutral-400"} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-5 space-y-4">
                    {isLoading && errors.length === 0 ? (
                        <div className="h-40 flex items-center justify-center font-mono text-[10px] text-neutral-300">
                            SCANNING_FOR_ANOMALIES...
                        </div>
                    ) : errors.length === 0 ? (
                        <div className="p-12 border border-dashed border-neutral-200 text-center space-y-2">
                            <CheckCircle size={32} className="mx-auto text-green-200" />
                            <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Atmosphere Clear</p>
                        </div>
                    ) : (
                        <div className="max-h-[600px] overflow-y-auto pr-2 space-y-3 thin-scrollbar">
                            {errors.map((error) => (
                                <motion.div
                                    key={error.id}
                                    layoutId={error.id}
                                    onClick={() => setSelectedError(error)}
                                    className={`p-4 border transition-all cursor-pointer group ${selectedError?.id === error.id
                                            ? "border-black bg-neutral-50"
                                            : "border-neutral-200 hover:border-neutral-400 bg-white"
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${error.status === 'Unresolved' ? "bg-red-500" :
                                                    error.status === 'Investigating' ? "bg-amber-500" : "bg-green-500"
                                                }`} />
                                            <span className="text-[10px] font-mono text-neutral-400">@ {error.location}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-neutral-300 uppercase tracking-tighter">
                                            {format(new Date(error.created_at), 'HH:mm:ss')}
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium text-black line-clamp-2 leading-relaxed italic">{error.message}</p>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-7">
                    <AnimatePresence mode="wait">
                        {selectedError ? (
                            <motion.div
                                key={selectedError.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-white border border-neutral-200 p-8 space-y-8 sticky top-8"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-light tracking-tight">{selectedError.message}</h3>
                                        <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">TRACE_BACK_ID: {selectedError.id}</p>
                                    </div>
                                    <button onClick={() => setSelectedError(null)} className="text-neutral-300 hover:text-black transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-neutral-50 border border-neutral-100">
                                        <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 mb-1">Occurrence</p>
                                        <p className="text-xs italic">{format(new Date(selectedError.created_at), 'PPP p')}</p>
                                    </div>
                                    <div className="p-4 bg-neutral-50 border border-neutral-100">
                                        <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 mb-1">Status</p>
                                        <select
                                            value={selectedError.status}
                                            onChange={(e) => updateStatus(selectedError.id, e.target.value as any)}
                                            className="bg-transparent text-xs font-bold uppercase tracking-widest w-full outline-none"
                                        >
                                            <option value="Unresolved">Unresolved</option>
                                            <option value="Investigating">Investigating</option>
                                            <option value="Resolved">Resolved</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-neutral-400">
                                        <Code size={14} />
                                        <span className="text-[10px] uppercase font-bold tracking-widest">Stack Manifest</span>
                                    </div>
                                    <div className="p-4 bg-neutral-900 text-neutral-400 text-[10px] font-mono overflow-x-auto whitespace-pre leading-relaxed border-l-4 border-red-500">
                                        {selectedError.stack || "NO_STACK_MANIFEST_AVAILABLE"}
                                    </div>
                                </div>

                                {selectedError.fix_suggestion && (
                                    <div className="p-6 bg-green-50/50 border border-green-100 rounded-sm">
                                        <p className="text-[10px] uppercase font-bold tracking-widest text-green-600 mb-2 flex items-center gap-2">
                                            <CheckCircle size={12} /> Strategic Recommendation
                                        </p>
                                        <p className="text-xs text-neutral-700 leading-relaxed italic">{selectedError.fix_suggestion}</p>
                                    </div>
                                )}

                                <div className="pt-8 border-t border-neutral-100 flex justify-between items-center">
                                    <button
                                        onClick={() => deleteError(selectedError.id)}
                                        className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-700 flex items-center gap-2 transition-colors"
                                    >
                                        <Trash2 size={14} /> Purge Intelligence Log
                                    </button>
                                    <span className="text-[10px] font-mono text-neutral-300 italic italic">SYNC_STATUS: ENCRYPTED</span>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="h-[500px] border border-dashed border-neutral-200 flex flex-col items-center justify-center text-neutral-300 space-y-4">
                                <Filter size={48} strokeWidth={0.5} />
                                <p className="text-[10px] font-bold uppercase tracking-widest">Select an anomaly for analysis</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
