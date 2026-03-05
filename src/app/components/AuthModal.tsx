import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Mail, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { errorService } from "../lib/ErrorService";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            onSuccess();
        } catch (err: any) {
            const genericMsg = await errorService.logError(err, "AuthModal.handleLogin");
            setError(err.message || genericMsg);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white w-full max-w-md p-10 shadow-2xl relative overflow-hidden"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 text-neutral-400 hover:text-black transition-colors"
                    >
                        <X size={24} />
                    </button>

                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-6">
                            <div className="p-3 bg-black text-white">
                                <ShieldCheck size={24} />
                            </div>
                        </div>
                        <h2 className="text-2xl font-light italic mb-1">Dossier <span className="font-bold not-italic">Authentication</span></h2>
                        <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-neutral-400">Identity Verification Required</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Identity Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter Principal Email"
                                    className="w-full bg-neutral-50 border border-neutral-200 p-4 pl-12 text-sm outline-none focus:border-black transition-all"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Access Key</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-neutral-50 border border-neutral-200 p-4 pl-12 text-sm outline-none focus:border-black transition-all"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <p className="text-[10px] text-red-500 font-bold uppercase tracking-tight text-center italic">{error}</p>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-5 bg-black text-white text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-neutral-800 transition-all shadow-xl disabled:opacity-50"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> Verifying...
                                </>
                            ) : (
                                <>
                                    Unlock Intelligence <ArrowRight size={14} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-[9px] text-neutral-400 uppercase tracking-widest font-bold leading-relaxed">
                        Authorized personnel only. All access attempts are monitored and recorded by CortDevs Systems.
                    </p>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
