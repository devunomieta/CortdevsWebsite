import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, ExternalLink, FileText, ArrowRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { format } from "date-fns";

interface Broadcast {
    id: string;
    doc_id: string;
    title: string;
    category: string;
    created_at: string;
    documentation: {
        title: string;
        file_url: string;
        file_type: string;
    };
}

export function DocUpdateBanner({ role }: { role: string }) {
    const [latestBroadcast, setLatestBroadcast] = useState<Broadcast | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        const dismissKey = `dismissed_broadcast_${latestBroadcast?.id}`;
        if (latestBroadcast && !localStorage.getItem(dismissKey)) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [latestBroadcast]);

    useEffect(() => {
        fetchLatest();

        const subscription = supabase
            .channel('doc_broadcasts_realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'doc_broadcasts'
            }, () => {
                fetchLatest();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [role]);

    const fetchLatest = async () => {
        const { data, error } = await supabase
            .from('doc_broadcasts')
            .select(`
                *,
                documentation(title, file_url, file_type)
            `)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1);

        if (data && data[0]) {
            // Check if user role is in target_roles (if not empty)
            const targetRoles = data[0].target_roles || [];
            if (targetRoles.length === 0 || targetRoles.includes(role) || role === 'Superadmin') {
                setLatestBroadcast(data[0]);
            }
        }
    };

    const handleDismiss = () => {
        if (latestBroadcast) {
            localStorage.setItem(`dismissed_broadcast_${latestBroadcast.id}`, 'true');
        }
        setIsVisible(false);
    };

    if (!isVisible || !latestBroadcast) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-black text-white overflow-hidden relative"
            >
                <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-neutral-800 flex items-center justify-center rounded-sm shrink-0">
                            <Bell size={18} className="text-white animate-pulse" />
                        </div>
                        <div>
                            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-neutral-400 block mb-0.5">Fresh Intelligence Detected</span>
                            <h4 className="text-xs font-bold uppercase tracking-widest leading-none">
                                Updated: {latestBroadcast.documentation?.title || latestBroadcast.title}
                            </h4>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden lg:block border-l border-neutral-800 h-10 mx-2"></div>
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">Category</span>
                            <span className="text-[10px] font-bold uppercase text-white">{latestBroadcast.category}</span>
                        </div>

                        <a
                            href={latestBroadcast.documentation?.file_url}
                            target="_blank"
                            className="flex items-center gap-3 bg-white text-black px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-200 transition-all group"
                        >
                            Review Preview <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </a>

                        <button
                            onClick={handleDismiss}
                            className="text-neutral-500 hover:text-white transition-colors p-2"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="absolute bottom-0 left-0 h-[2px] bg-white w-full opacity-10"></div>
                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.5 }}
                    className="absolute bottom-0 left-0 h-[2px] bg-white w-full origin-left opacity-30"
                />
            </motion.div>
        </AnimatePresence>
    );
}
