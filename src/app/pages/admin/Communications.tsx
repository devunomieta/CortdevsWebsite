import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
    Mail,
    Send,
    Settings,
    Users,
    FileText,
    Plus,
    Save,
    CheckCircle2,
    AlertCircle,
    Clock,
    Layout,
    ChevronRight,
    RefreshCw
} from "lucide-react";

export function Communications() {
    const [activeTab, setActiveTab] = useState<"smtp" | "newsletter" | "templates" | "mailbox">("mailbox");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Form States
    const [smtp, setSmtp] = useState({
        host: "",
        port: 465,
        user: "",
        password: ""
    });

    const [templates, setTemplates] = useState<any[]>([]);
    const [newsletterList, setNewsletterList] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [selectedMessage, setSelectedMessage] = useState<any | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch SMTP
            const { data: smtpData } = await supabase
                .from('smtp_settings')
                .select('*')
                .eq('id', 'main')
                .single();
            if (smtpData) setSmtp({
                host: smtpData.host || "",
                port: smtpData.port || 465,
                user: smtpData.user || "",
                password: smtpData.password || ""
            });

            // 2. Fetch Newsletter
            const { data: newsData } = await supabase
                .from('newsletter_subscribers')
                .select('*')
                .order('created_at', { ascending: false });
            if (newsData) setNewsletterList(newsData);

            // 3. Fetch Templates
            const { data: tempData } = await supabase
                .from('email_templates')
                .select('*')
                .order('updated_at', { ascending: false });
            if (tempData) setTemplates(tempData);

            // 4. Fetch Messages
            const { data: msgData } = await supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: false });
            if (msgData) setMessages(msgData);

        } catch (err) {
            console.error("Error fetching communication data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveSmtp = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('smtp_settings')
                .upsert({
                    id: 'main',
                    ...smtp,
                    updated_at: new Date().toISOString()
                });
            if (error) throw error;
            alert("SMTP settings updated successfully.");
        } catch (err: any) {
            alert("Failed to save SMTP settings: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-light tracking-tight italic">Communications Hub</h2>
                    <p className="text-sm text-neutral-500">Manage SMTP protocols, outreach campaigns, and branding templates.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-200 gap-8">
                {[
                    { id: "smtp", label: "SMTP Configuration", icon: <Settings size={14} /> },
                    { id: "newsletter", label: "Newsletter & Outreach", icon: <Users size={14} /> },
                    { id: "templates", label: "Mail Templates", icon: <Layout size={14} /> },
                    { id: "mailbox", label: "Mailbox", icon: <Mail size={14} /> },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`pb-4 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-all relative ${activeTab === tab.id ? "text-black" : "text-neutral-400 hover:text-black"
                            }`}
                    >
                        {tab.icon} {tab.label}
                        {activeTab === tab.id && (
                            <motion.div layoutId="tab-active" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-black" />
                        )}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-8">
                    {activeTab === "smtp" && (
                        <div className="bg-white border border-neutral-200 p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">SMTP Host</label>
                                    <input
                                        type="text"
                                        value={smtp.host}
                                        onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                                        className="w-full text-xs font-mono p-4 border border-neutral-100 focus:border-black outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">SMTP Port</label>
                                    <input
                                        type="number"
                                        value={smtp.port}
                                        onChange={(e) => setSmtp({ ...smtp, port: parseInt(e.target.value) || 0 })}
                                        className="w-full text-xs font-mono p-4 border border-neutral-100 focus:border-black outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Auth User</label>
                                    <input
                                        type="text"
                                        value={smtp.user}
                                        onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                                        className="w-full text-xs font-mono p-4 border border-neutral-100 focus:border-black outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Auth Password</label>
                                    <input
                                        type="password"
                                        value={smtp.password}
                                        onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                                        className="w-full text-xs font-mono p-4 border border-neutral-100 focus:border-black outline-none transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-neutral-50 flex justify-between items-center">
                                <button className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-all disabled:opacity-50">
                                    Test Connection <Clock size={14} />
                                </button>
                                <button
                                    onClick={handleSaveSmtp}
                                    disabled={isSaving}
                                    className="bg-black text-white px-8 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:bg-neutral-400"
                                >
                                    {isSaving ? "Saving..." : "Commit Config"}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "newsletter" && (
                        <div className="bg-white border border-neutral-200 overflow-hidden">
                            <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest font-bold">Subscription Intelligence</h3>
                                <div className="flex gap-4">
                                    <button
                                        onClick={fetchData}
                                        disabled={isLoading}
                                        className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black flex items-center gap-1"
                                    >
                                        <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
                                    </button>
                                    <button className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black flex items-center gap-1">
                                        Export CSV <CheckCircle2 size={12} />
                                    </button>
                                </div>
                            </div>
                            <div className="min-h-[300px]">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-20">
                                        <RefreshCw className="w-6 h-6 text-neutral-200 animate-spin" />
                                    </div>
                                ) : newsletterList.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                                        <Users size={32} className="opacity-10 mb-2" />
                                        <p className="text-xs italic tracking-wide">No active subscribers in the network.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-neutral-50 text-[10px] uppercase tracking-widest text-neutral-400 font-bold">
                                                <th className="p-4">Email Address</th>
                                                <th className="p-4">Status</th>
                                                <th className="p-4 text-right">Incepted</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-xs">
                                            {newsletterList.map((item, i) => (
                                                <tr key={i} className="border-b border-neutral-50 group hover:bg-neutral-50 transition-all">
                                                    <td className="p-4 font-medium">{item.email}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${item.status === 'Subscribed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right text-neutral-400">
                                                        {new Date(item.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}

                </div>
                    )}

                {activeTab === "mailbox" && (
                    <div className="space-y-6">
                        <div className="bg-white border border-neutral-200">
                            <div className="p-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest">Communication Logs</h3>
                                <div className="flex gap-4">
                                    <span className="text-[9px] font-bold uppercase text-neutral-400">{messages.length} Messages Total</span>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-neutral-100 text-[9px] uppercase tracking-widest text-neutral-400 font-bold bg-white">
                                            <th className="p-4">Recipient</th>
                                            <th className="p-4">Subject</th>
                                            <th className="p-4">Category</th>
                                            <th className="p-4 text-right">Date Transmitted</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs">
                                        {messages.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-12 text-center text-neutral-400 italic">
                                                    No message history recorded yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            messages.map((msg) => (
                                                <tr
                                                    key={msg.id}
                                                    onClick={() => setSelectedMessage(msg)}
                                                    className={`border-b border-neutral-50 hover:bg-neutral-50 transition-all cursor-pointer ${selectedMessage?.id === msg.id ? 'bg-neutral-50' : ''}`}
                                                >
                                                    <td className="p-4 font-medium">{msg.receiver_email}</td>
                                                    <td className="p-4">
                                                        <div className="max-w-[200px] truncate">{msg.subject || "(No Subject)"}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="px-2 py-0.5 bg-neutral-100 text-[9px] font-bold uppercase tracking-tight">
                                                            {msg.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right text-neutral-400 font-mono text-[10px]">
                                                        {new Date(msg.created_at).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <AnimatePresence>
                            {selectedMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-neutral-900 text-white p-8 space-y-6 relative"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">Transmission Details</p>
                                            <h4 className="text-lg font-light italic">{selectedMessage.subject || "No Subject"}</h4>
                                        </div>
                                        <button
                                            onClick={() => setSelectedMessage(null)}
                                            className="text-neutral-500 hover:text-white transition-colors"
                                        >
                                            <RefreshCw size={14} className="rotate-45" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8 text-[10px] uppercase tracking-widest font-bold border-y border-white/10 py-4">
                                        <div>
                                            <span className="text-neutral-500 block mb-1">To</span>
                                            <span>{selectedMessage.receiver_email}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-neutral-500 block mb-1">Status</span>
                                            <span className="text-green-500">Delivered via SMTP</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Message Payload</p>
                                        <div className="text-sm font-light leading-relaxed text-neutral-300 whitespace-pre-wrap">
                                            {selectedMessage.body}
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-white/5 flex justify-end">
                                        <button className="px-6 py-2 border border-white/20 text-[10px] uppercase font-bold tracking-widest hover:bg-white hover:text-black transition-all">
                                            Re-transmit Message
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Sidebar Controls */}
            <div className="space-y-8">
                <div className="bg-neutral-900 text-white p-8 space-y-6 relative overflow-hidden">
                    <h3 className="text-xl font-light italic leading-tight">Mass Outreach<br />Engine</h3>
                    <p className="text-xs text-neutral-400 leading-relaxed uppercase tracking-widest">Broadcast dynamic communications to your entire intelligence network.</p>
                    <button className="w-full py-4 bg-white text-black text-[10px] uppercase font-bold tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-neutral-100 transition-all">
                        Compose Broadcast <Send size={14} />
                    </button>
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                </div>

                <div className="p-6 bg-white border border-neutral-200">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4">Transmission Health</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-500">SMTP Response</span>
                            <span className="text-green-600 font-bold">24ms</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-500">Mails Sent (MTD)</span>
                            <span className="font-bold font-mono">1,204</span>
                        </div>
                        <div className="w-full h-1 bg-neutral-100">
                            <div className="w-3/4 h-full bg-black"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </div >
    );
}
