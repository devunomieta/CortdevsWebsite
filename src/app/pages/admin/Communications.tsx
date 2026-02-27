import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    ChevronRight
} from "lucide-react";

export function Communications() {
    const [activeTab, setActiveTab] = useState<"smtp" | "newsletter" | "templates">("smtp");
    const [isSaving, setIsSaving] = useState(false);

    const templates = [
        { name: "Project Proposal v1", lastEdited: "2d ago", type: "Sales" },
        { name: "Welcome Newsletter", lastEdited: "1w ago", type: "Marketing" },
        { name: "Maintenance Update", lastEdited: "3h ago", type: "Support" },
    ];

    const newsletterList = [
        { email: "john@doe.com", status: "Subscribed", date: "Mar 20, 2024" },
        { email: "alice@tech.io", status: "Subscribed", date: "Mar 22, 2024" },
        { email: "bob@startup.inc", status: "Unsubscribed", date: "Mar 25, 2024" },
    ];

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
                                    <input type="text" defaultValue="mail.cortdevs.com" className="w-full text-xs font-mono p-4 border border-neutral-100 focus:border-black outline-none transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">SMTP Port</label>
                                    <input type="text" defaultValue="465" className="w-full text-xs font-mono p-4 border border-neutral-100 focus:border-black outline-none transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Auth User</label>
                                    <input type="text" defaultValue="projects@cortdevs.com" className="w-full text-xs font-mono p-4 border border-neutral-100 focus:border-black outline-none transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Auth Password</label>
                                    <input type="password" defaultValue="********" className="w-full text-xs font-mono p-4 border border-neutral-100 focus:border-black outline-none transition-all" />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-neutral-50 flex justify-between items-center">
                                <button className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-all">
                                    Test Connection <Clock size={14} />
                                </button>
                                <button className="bg-black text-white px-8 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all">
                                    Commit Config
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "newsletter" && (
                        <div className="bg-white border border-neutral-200 overflow-hidden">
                            <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest font-bold">Subscription Intelligence</h3>
                                <button className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black flex items-center gap-1">
                                    Export CSV <CheckCircle2 size={12} />
                                </button>
                            </div>
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
                                        <tr key={i} className="border-b border-neutral-50">
                                            <td className="p-4 font-medium">{item.email}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${item.status === 'Subscribed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right text-neutral-400">{item.date}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === "templates" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {templates.map((template, i) => (
                                <div key={i} className="bg-white border border-neutral-200 p-6 hover:shadow-xl transition-all group cursor-pointer">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="p-2 bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                                            <FileText size={20} />
                                        </div>
                                        <span className="text-[9px] font-bold uppercase bg-neutral-100 px-2 py-0.5">{template.type}</span>
                                    </div>
                                    <h4 className="font-medium text-sm mb-1">{template.name}</h4>
                                    <p className="text-[10px] text-neutral-400 italic">Modified {template.lastEdited}</p>
                                </div>
                            ))}
                            <button className="border-2 border-dashed border-neutral-200 p-6 flex flex-col items-center justify-center gap-3 text-neutral-400 hover:border-black hover:text-black transition-all">
                                <Plus size={24} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">New Template</span>
                            </button>
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
        </div>
    );
}
