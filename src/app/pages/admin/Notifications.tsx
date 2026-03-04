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
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Filter,
    X,
    Plus,
    ArrowLeft
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
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("All");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

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
        const matchesStatus = filter === 'unread' ? !n.read : filter === 'read' ? n.read : true;
        const matchesType = typeFilter === "All" || n.type === typeFilter;
        const matchesSearch = n.message.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesType && matchesSearch;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginatedNotifications = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
            <Link
                to="/admin"
                className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
            >
                <ArrowLeft size={12} /> Back to Dashboard
            </Link>
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
                <div className="border-b border-neutral-100 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex gap-6 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        {(['all', 'unread', 'read'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => {
                                    setFilter(f);
                                    setCurrentPage(1);
                                }}
                                className={`text-[10px] font-bold uppercase tracking-widest transition-all relative pb-2 whitespace-nowrap ${filter === f ? "text-black" : "text-neutral-300"}`}
                            >
                                {f}
                                {filter === f && <motion.div layoutId="notif-filter" className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search signals..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-100 outline-none focus:border-black transition-all text-[10px] font-bold uppercase tracking-wider"
                            />
                        </div>
                        <select
                            value={typeFilter}
                            onChange={(e) => {
                                setTypeFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="flex-1 md:flex-none px-4 py-2 bg-neutral-50 border border-neutral-100 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-black transition-all min-w-[120px]"
                        >
                            {["All", "Lead", "Transaction", "System", "Review"].map(t => (
                                <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>
                            ))}
                        </select>
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
                            {paginatedNotifications.map((n) => (
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

                {totalPages > 1 && (
                    <div className="p-6 border-t border-neutral-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                        <p>Showing {paginatedNotifications.length} of {filtered.length} signals</p>
                        <div className="flex items-center gap-4">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                                className="p-2 border border-neutral-100 hover:bg-neutral-50 transition-all disabled:opacity-30"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span>Page {currentPage} of {totalPages}</span>
                            <div className="flex items-center gap-2 px-2 border-l border-neutral-100 ml-2">
                                <span className="text-[9px] text-neutral-400">Jump:</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={totalPages}
                                    value={currentPage}
                                    onChange={(e) => {
                                        const p = parseInt(e.target.value);
                                        if (p >= 1 && p <= totalPages) setCurrentPage(p);
                                    }}
                                    className="w-10 py-1 bg-white border border-neutral-200 text-center outline-none focus:border-black transition-all"
                                />
                            </div>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="p-2 border border-neutral-100 hover:bg-neutral-50 transition-all disabled:opacity-30"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
