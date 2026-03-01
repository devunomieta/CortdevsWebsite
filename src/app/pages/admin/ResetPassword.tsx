import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../../lib/supabase";
import { motion } from "framer-motion";
import { Lock, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";
import { BrandLoader } from "../../components/BrandLoader";
import { errorService } from "../../../lib/ErrorService";
import { useToast } from "../../components/Toast";

export function ResetPassword() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        // Check if we have an active session or recovery token in the URL
        // Supabase UI handles the "recovery" type automatically if configured,
        // but we need to ensure the user is "authenticated" or has the right metadata.
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If no session, it might be an invalid or expired link
                // But Supabase often puts the user in a temporary session during recovery
            }
        };
        checkSession();
    }, [navigate]);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) throw updateError;

            // Log successful rotation
            await supabase.from('audit_logs').insert([{
                action: 'PASSWORD_RESET_SUCCESS',
                target_type: 'Self'
            }]);

            setIsSuccess(true);
            showToast("Access Key rotated successfully.", "success");
            setTimeout(() => navigate("/admin/login"), 3000);
        } catch (err: any) {
            const genericMsg = await errorService.logError(err, "ResetPassword.handleUpdatePassword");
            setError(err.message || genericMsg);
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                    <div className="flex justify-center">
                        <CheckCircle2 size={64} className="text-green-500" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-light italic">Rotation Complete</h1>
                        <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold">Identity Portal Resynchronized</p>
                    </div>
                    <p className="text-xs text-neutral-400 italic">Redirecting to Authentication Core...</p>
                    <button
                        onClick={() => navigate("/admin/login")}
                        className="w-full py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                        Authenticate Now <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full">
                <div className="text-center mb-12">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-black text-white shadow-xl">
                            <ShieldCheck size={32} />
                        </div>
                    </div>
                    <h1 className="text-3xl font-light italic tracking-tight mb-2">Configure Access Key</h1>
                    <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold font-bold">Secure Coordinate Update</p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-neutral-200 p-10 shadow-2xl relative overflow-hidden"
                >
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm">
                            <BrandLoader />
                        </div>
                    )}

                    <form onSubmit={handleUpdatePassword} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">New Access Key</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-neutral-50 border border-neutral-100 p-4 pl-12 text-sm outline-none focus:border-black transition-all"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Confirm Rotation</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" size={18} />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-neutral-50 border border-neutral-100 p-4 pl-12 text-sm outline-none focus:border-black transition-all"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <p className="text-xs text-red-500 font-bold uppercase tracking-tighter text-center italic">{error}</p>
                        )}

                        <button
                            type="submit"
                            className="w-full py-5 bg-black text-white text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-neutral-800 transition-all"
                        >
                            Finalize Key Rotation <ShieldCheck size={14} />
                        </button>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
