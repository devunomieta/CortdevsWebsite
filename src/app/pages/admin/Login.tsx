import React, { useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../../lib/supabase";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";
import { errorService } from "../../../lib/ErrorService";
import { BrandLoader } from "../../components/BrandLoader";

export function AdminLogin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            if (data.user) {
                localStorage.setItem("admin_auth", "true");
                navigate("/admin");
            }
        } catch (err: any) {
            const genericMsg = await errorService.logError(err, "AdminLogin.handleLogin");
            setError(err.message || genericMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6 bg-neutral-50">
            <div className="max-w-md w-full">
                <div className="text-center mb-12">
                    <div className="flex justify-center mb-8">
                        <div className="p-4 bg-black text-white">
                            <ShieldCheck size={32} />
                        </div>
                    </div>
                    <h1 className="text-3xl font-light italic tracking-tight mb-2">Administrative Access</h1>
                    <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold">Secure Intelligence Portal</p>
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

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Identity Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter Key Combinations"
                                    className="w-full bg-neutral-50 border border-neutral-100 p-4 pl-12 text-sm outline-none focus:border-black transition-all"
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
                            className="w-full py-5 bg-black text-white text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
                        >
                            Authenticate Portal <ArrowRight size={14} />
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => navigate("/admin/forgot-password")}
                            className="text-[10px] uppercase tracking-widest font-bold text-neutral-400 hover:text-black transition-colors"
                        >
                            Forgot Access Key? Init Rotation
                        </button>
                    </div>
                </motion.div>

                <p className="text-center mt-8 text-[10px] text-neutral-400 uppercase tracking-widest font-bold">
                    © 2024 CortDevs Intelligence Systems
                </p>
            </div>
        </div>
    );
}
