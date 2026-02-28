import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
    Bell,
    CheckCircle2,
    AlertCircle,
    MessageSquare,
    DollarSign,
    Trash2,
    Clock,
    Search,
    RefreshCw
} from "lucide-react";
import { Link } from "react-router";

interface Notification {
    id: string;
    type: 'Lead' | 'Transaction' | 'System' | 'Review';
    message: string;
    link?: string;
    read: boolean;
    created_at: string;
}

export function Notifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

    const fetchNotifications = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotifications(data || []);
        } catch (err) {
            console.error("Error fetching notifications:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const markAsRead = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', id);

            if (error) throw error;
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (err) {
            console.error("Error marking as read:", err);
        }
    };

    const markAllRead = async () => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('read', false);

            if (error) throw error;
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (err) {
            console.error("Error marking all read:", err);
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error("Error deleting notification:", err);
        }
    };

    useEffect(() => {
        fetchNotifications();

        // Subscribe to real-time notifications
        const channel = supabase
            .channel('public:notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
                setNotifications(prev => [payload.new as Notification, ...prev]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const filtered = notifications.filter(n => {
        if (filter === 'unread') return !n.read;
        if (filter === 'read') return n.read;
        return true;
    });

    const getTypeIcon = (type: Notification['type']) => {
        switch (type) {
            case 'Lead': return <MessageSquare size={16} className="text-blue-500" />;
            case 'Transaction': return <DollarSign size={16} className="text-green-500" />;
            case 'Review': return <CheckCircle2 size={16} className="text-purple-500" />;
            default: return <AlertCircle size={16} className="text-orange-500" />;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-light tracking-tight italic">Notifications Hub</h2>
                    <p className="text-sm text-neutral-500">Stay responsive to platform events and system triggers.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={markAllRead}
                        className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
                    >
                        Mark All Read
                    </button>
                    <button
                        onClick={fetchNotifications}
                        className="p-2 border border-neutral-100 hover:bg-neutral-50 transition-colors"
                    >
                        <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                    </button>
                </div>
            </header>

            <div className="bg-white border border-neutral-200 min-h-[500px] flex flex-col">
                <div className="border-b border-neutral-100 p-6 flex justify-between items-center">
                    <div className="flex gap-6">
                        {(['all', 'unread', 'read'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`text-[10px] font-bold uppercase tracking-widest transition-all relative pb-2 ${filter === f ? "text-black" : "text-neutral-300"}`}
                            >
                                {f}
                                {filter === f && <motion.div layoutId="notif-filter" className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isLoading && notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 opacity-20">
                            <RefreshCw size={32} className="animate-spin mb-4" />
                            <p className="text-xs uppercase tracking-widest font-bold">Scanning Signals...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 text-neutral-300 italic">
                            <Bell size={48} className="stroke-1 opacity-20 mb-4" />
                            <p className="text-sm">Ecosystem status: Clear.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-neutral-50">
                            {filtered.map((n) => (
                                <div
                                    key={n.id}
                                    className={`p-6 flex items-start gap-4 hover:bg-neutral-50 transition-colors group ${!n.read ? "bg-blue-50/30" : ""}`}
                                >
                                    <div className="mt-1">{getTypeIcon(n.type)}</div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between items-start">
                                            <p className={`text-sm ${!n.read ? "font-semibold text-neutral-900" : "text-neutral-600"}`}>
                                                {n.message}
                                            </p>
                                            <span className="text-[9px] text-neutral-400 font-mono uppercase">
                                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {n.link && (
                                                <Link
                                                    to={n.link}
                                                    onClick={() => markAsRead(n.id)}
                                                    className="text-[10px] font-bold uppercase tracking-widest text-black hover:underline"
                                                >
                                                    View Context
                                                </Link>
                                            )}
                                            {!n.read && (
                                                <button
                                                    onClick={() => markAsRead(n.id)}
                                                    className="text-[10px] font-bold uppercase tracking-widest text-blue-600"
                                                >
                                                    Mark Read
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteNotification(n.id)}
                                                className="text-[10px] font-bold uppercase tracking-widest text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
