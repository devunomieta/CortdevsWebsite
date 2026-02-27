import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    User,
    Mail,
    Lock,
    Shield,
    Save,
    CheckCircle2,
    Camera,
    LogOut,
    Bell,
    Key
} from "lucide-react";
import { useNavigate } from "react-router";

export function Profile() {
    const navigate = useNavigate();
    const [saveStatus, setSaveStatus] = useState<"idle" | "success">("idle");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 3000);
        }, 1500);
    };

    const handleLogout = () => {
        localStorage.removeItem("admin_auth");
        navigate("/admin/login");
    };

    return (
        <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-light tracking-tight italic">Administrator Dossier</h2>
                    <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold mt-1">Personnel Management</p>
                </div>

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors"
                >
                    De-authenticate <LogOut size={14} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-8">
                    <form onSubmit={handleSave} className="bg-white border border-neutral-200 p-10 space-y-8 shadow-sm">
                        <div className="flex items-center gap-8">
                            <div className="relative group">
                                <div className="w-24 h-24 bg-black text-white flex items-center justify-center text-4xl font-light italic">
                                    H
                                </div>
                                <button type="button" className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <Camera size={20} />
                                </button>
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-light tracking-tight">HachStack CEO</h3>
                                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">Super Administrator</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Personnel Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" size={16} />
                                    <input type="text" defaultValue="HachStack CEO" className="w-full bg-neutral-50 border border-neutral-100 p-4 pl-12 text-sm outline-none focus:border-black transition-all" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Communications Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" size={16} />
                                    <input type="email" defaultValue="projects@cortdevs.com" className="w-full bg-neutral-50 border border-neutral-100 p-4 pl-12 text-sm outline-none focus:border-black transition-all" />
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-neutral-100 space-y-8">
                            <div className="flex items-center gap-2 mb-4">
                                <Lock size={16} className="text-neutral-400" />
                                <h3 className="text-[10px] font-bold uppercase tracking-widest italic">Credential Rotation</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">New Access Key</label>
                                    <input type="password" placeholder="••••••••" className="w-full bg-neutral-50 border border-neutral-100 p-4 text-sm outline-none focus:border-black transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Confirm Rotation</label>
                                    <input type="password" placeholder="••••••••" className="w-full bg-neutral-50 border border-neutral-100 p-4 text-sm outline-none focus:border-black transition-all" />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-between items-center">
                            <AnimatePresence>
                                {saveStatus === "success" && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center gap-2 text-green-600 text-[10px] font-bold uppercase tracking-widest"
                                    >
                                        <CheckCircle2 size={14} /> Dossier Synchronized
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="bg-black text-white px-10 py-5 text-[10px] font-bold uppercase tracking-[0.3em] flex items-center gap-4 hover:bg-neutral-800 transition-all disabled:opacity-50 ml-auto"
                            >
                                {isSaving ? "Rotating..." : "Commit Update"}
                                <Save size={16} />
                            </button>
                        </div>
                    </form>
                </div>

                <div className="space-y-6">
                    <div className="bg-neutral-900 text-white p-8 space-y-6">
                        <div className="flex items-center gap-2">
                            <Shield size={18} className="text-green-400" />
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Active Permissions</h3>
                        </div>
                        <div className="space-y-4 pt-4">
                            <div className="flex justify-between items-center text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-b border-white/5 pb-2">
                                <span>Domain Infrastructure</span>
                                <span className="text-white">Active</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-b border-white/5 pb-2">
                                <span>CRM Core Protocol</span>
                                <span className="text-white">Active</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-b border-white/5 pb-2">
                                <span>Economic Intelligence</span>
                                <span className="text-white">Active</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 border border-neutral-200 space-y-6">
                        <div className="flex items-center gap-2">
                            <Bell size={16} className="text-neutral-400" />
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Intelligence Feeds</h3>
                        </div>
                        <p className="text-xs text-neutral-500 italic">No critical security overrides detected in the last 24 cycles.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
