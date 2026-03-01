import React, { useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowLeft, Send, CheckCircle2, ShieldAlert } from "lucide-react";
import { BrandLoader } from "../../components/BrandLoader";
import { errorService } from "../../../lib/ErrorService";

export function ForgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState("");

    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            // 1. Check Rate Limit via custom API
            const rateResponse = await fetch('/api/auth/request-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            let rateData = { error: "Security subsystem oscillation." };
            try {
                if (rateResponse.headers.get("content-type")?.includes("application/json")) {
                    rateData = await rateResponse.json();
                }
            } catch (pErr) {
                console.error("JSON parse failed", pErr);
            }

            if (!rateResponse.ok) {
                const errorMsg = rateData.details ? `${rateData.error} (${rateData.details})` : (rateData.error || "Intelligence Link Failure (API Synchronization Error).");
                throw new Error(errorMsg);
            }

            setIsSent(true);
        } catch (err: any) {
            const genericMsg = await errorService.logError(err, "ForgotPassword.handleRequestReset");
            setError(err.message || genericMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full">
                <button
                    onClick={() => navigate("/admin/login")}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-neutral-400 hover:text-black transition-colors mb-8"
                >
                    <ArrowLeft size={14} /> Back to Authentication
                </button>

                <div className="text-center mb-12">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-black text-white">
                            <ShieldAlert size={32} />
                        </div>
                    </div>
                    <h1 className="text-3xl font-light italic tracking-tight mb-2">Access Key Rotation</h1>
                    <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold font-bold">Identity Verification Required</p>
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white border border-neutral-200 p-10 shadow-2xl relative overflow-hidden"
                >
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm">
                            <BrandLoader />
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {!isSent ? (
                            <motion.form
                                key="form"
                                initial={{ opacity: 1 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleRequestReset}
                                className="space-y-6"
                            >
                                <p className="text-xs text-neutral-500 leading-relaxed italic text-center">
                                    Enter your registered identity email. A secure rotation link will be transmitted if the account is verified.
                                </p>

                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Registered Email</label>
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

                                {error && (
                                    <p className="text-xs text-red-500 font-bold uppercase tracking-tighter text-center italic">{error}</p>
                                )}

                                <button
                                    type="submit"
                                    className="w-full py-5 bg-black text-white text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
                                >
                                    Transmit Reset Link <Send size={14} />
                                </button>
                            </motion.form>
                        ) : (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-center space-y-6"
                            >
                                <div className="flex justify-center">
                                    <CheckCircle2 size={48} className="text-green-500" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-light italic">Transmission Successful</h3>
                                    <p className="text-xs text-neutral-500 leading-relaxed italic italic">
                                        Secure rotation coordinates have been sent to <span className="text-black font-bold">{email}</span>.
                                        Please check your transmission logs (inbox).
                                    </p>
                                </div>
                                <button
                                    onClick={() => navigate("/admin/login")}
                                    className="w-full py-4 border border-neutral-200 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-all"
                                >
                                    Return to Login
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}
