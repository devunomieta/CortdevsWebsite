import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../lib/supabase";
import { useToast } from "../../components/Toast";
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
    Key,
    RefreshCw
} from "lucide-react";
import { useNavigate } from "react-router";

export function Profile() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [saveStatus, setSaveStatus] = useState<"idle" | "success">("idle");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [profile, setProfile] = useState({
        full_name: "",
        email: "",
        role: "Editor",
        avatar_url: "",
        permissions: [] as string[]
    });
    const [passwordData, setPasswordData] = useState({
        newPassword: "",
        confirmPassword: ""
    });
    const [personalAudit, setPersonalAudit] = useState<any[]>([]);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate("/admin/login");
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (data) {
                setProfile({
                    full_name: data.full_name || "",
                    email: data.email || user.email || "",
                    role: data.role || "Editor",
                    avatar_url: data.avatar_url || "",
                    permissions: data.permissions || []
                });

                // Fetch personal audit
                const { data: audit } = await supabase
                    .from('audit_logs')
                    .select('*')
                    .eq('actor_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (audit) setPersonalAudit(audit);
            }
        } catch (err) {
            console.error("Error fetching profile:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Update Profile Information
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: profile.full_name,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // 2. Handle Password Change if provided
            if (passwordData.newPassword) {
                if (passwordData.newPassword !== passwordData.confirmPassword) {
                    throw new Error("Passwords do not match");
                }
                const { error: authError } = await supabase.auth.updateUser({
                    password: passwordData.newPassword
                });
                if (authError) throw authError;

                await supabase.from('audit_logs').insert([{
                    action: 'PASSWORD_ROTATED',
                    target_type: 'Self'
                }]);
            }

            setSaveStatus("success");
            showToast("Dossier synchronized securely.", "success");
            setPasswordData({ newPassword: "", confirmPassword: "" });
            setTimeout(() => setSaveStatus("idle"), 3000);
            fetchProfile();
        } catch (err: any) {
            showToast(err.message || "Failed to finalize dossier.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('assets')
                .getPublicUrl(filePath);

            await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
            showToast("Avatar updated successfully.", "success");
        } catch (err: any) {
            showToast(err.message || "Avatar upload failed.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
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
                                <div className="w-24 h-24 bg-black text-white flex items-center justify-center text-4xl font-light italic overflow-hidden">
                                    {profile.avatar_url ? (
                                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        profile.full_name.charAt(0) || "H"
                                    )}
                                </div>
                                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer">
                                    <Camera size={20} />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isSaving} />
                                </label>
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-light tracking-tight">{profile.full_name || "New Administrator"}</h3>
                                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">{profile.role}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Personnel Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" size={16} />
                                    <input
                                        type="text"
                                        value={profile.full_name}
                                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                        className="w-full bg-neutral-50 border border-neutral-100 p-4 pl-12 text-sm outline-none focus:border-black transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Communications Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" size={16} />
                                    <input
                                        type="email"
                                        value={profile.email}
                                        readOnly
                                        className="w-full bg-neutral-100 border border-neutral-100 p-4 pl-12 text-sm outline-none cursor-not-allowed italic text-neutral-400"
                                    />
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
                                    <input
                                        type="password"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        placeholder="••••••••"
                                        className="w-full bg-neutral-50 border border-neutral-100 p-4 text-sm outline-none focus:border-black transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Confirm Rotation</label>
                                    <input
                                        type="password"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        placeholder="••••••••"
                                        className="w-full bg-neutral-50 border border-neutral-100 p-4 text-sm outline-none focus:border-black transition-all"
                                    />
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
                            <h3 className="text-[10px] font-bold uppercase tracking-0.2em">Active Permissions</h3>
                        </div>
                        <div className="space-y-4 pt-4">
                            {profile.permissions.length === 0 ? (
                                <p className="text-[10px] text-neutral-500 italic">No custom overrides defined.</p>
                            ) : (
                                profile.permissions.map(perm => (
                                    <div key={perm} className="flex justify-between items-center text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-b border-white/5 pb-2">
                                        <span>{perm} Domain</span>
                                        <span className="text-white">Active</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="p-8 border border-neutral-200 space-y-6">
                        <div className="flex items-center gap-2">
                            <Bell size={16} className="text-neutral-400" />
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Intelligence Feeds</h3>
                        </div>
                        {personalAudit.length === 0 ? (
                            <p className="text-xs text-neutral-500 italic">No critical security overrides detected in the last 24 cycles.</p>
                        ) : (
                            <div className="space-y-4">
                                {personalAudit.map(log => (
                                    <div key={log.id} className="text-[10px] space-y-1">
                                        <p className="font-bold uppercase tracking-widest text-black">{log.action.replace('_', ' ')}</p>
                                        <p className="text-neutral-400 italic">{new Date(log.created_at).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
