import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Home, ShieldAlert, ArrowLeft } from "lucide-react";
import { BrandLoader } from "../components/BrandLoader";
import { supabase } from "../../lib/supabase";

export function NotFound() {
    const navigate = useNavigate();
    const [countdown, setCountdown] = useState(5);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsAdmin(!!session);
        };
        checkSession();

        const timer = setInterval(() => {
            setCountdown((prev) => prev - 1);
        }, 1000);

        const redirectTimeout = setTimeout(() => {
            if (isAdmin) {
                navigate("/admin");
            } else {
                navigate("/");
            }
        }, 5000);

        return () => {
            clearInterval(timer);
            clearTimeout(redirectTimeout);
        };
    }, [navigate, isAdmin]);

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decorative Element */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-neutral-50 rounded-full blur-3xl opacity-50 z-0" />

            <div className="max-w-md w-full text-center relative z-10 space-y-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="flex justify-center"
                >
                    <div className="relative">
                        <h1 className="text-[12rem] font-light leading-none tracking-tighter text-neutral-100 select-none">404</h1>
                        <div className="absolute inset-0 flex items-center justify-center pt-8">
                            <ShieldAlert size={64} className="text-black" strokeWidth={1} />
                        </div>
                    </div>
                </motion.div>

                <div className="space-y-2">
                    <h2 className="text-3xl font-light italic tracking-tight">Coordinate Mismatch</h2>
                    <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold">The requested intelligence does not exist</p>
                </div>

                <div className="p-8 bg-neutral-50 border border-neutral-100 space-y-4">
                    <p className="text-xs text-neutral-400 leading-relaxed italic">
                        The transmission path you followed points to a decommissioned or non-existent sector.
                        To maintain system integrity, we are initiating a tactical retreat.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <BrandLoader size="sm" />
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-black italic">
                            Redirecting to {isAdmin ? 'Command Center' : 'Public Portal'} in {countdown}s
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => navigate(isAdmin ? "/admin" : "/")}
                        className="w-full py-4 bg-black text-white text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
                    >
                        {isAdmin ? 'Return to Command' : 'Return Home'} <Home size={14} />
                    </button>
                    <button
                        onClick={() => navigate(-1)}
                        className="w-full py-4 border border-neutral-200 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-all"
                    >
                        <ArrowLeft size={12} className="inline mr-2" /> Resume Previous Path
                    </button>
                </div>

                <p className="text-[9px] text-neutral-300 uppercase tracking-[0.5em] pt-8">
                    CORTDEVS_SYSTEM_DEFENSE_PROTOCOL_404
                </p>
            </div>
        </div>
    );
}
