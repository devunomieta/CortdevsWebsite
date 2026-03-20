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
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
            {/* Background Decorative Element */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-secondary/20 rounded-full blur-3xl opacity-50 z-0" />

            <div className="max-w-md w-full text-center relative z-10 space-y-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="flex justify-center"
                >
                    <div className="relative">
                        <h1 className="text-[12rem] font-light leading-none tracking-tighter text-muted/10 select-none">404</h1>
                        <div className="absolute inset-0 flex items-center justify-center pt-8">
                            <ShieldAlert size={64} className="text-foreground" strokeWidth={1} />
                        </div>
                    </div>
                </motion.div>

                <div className="space-y-2">
                    <h2 className="text-3xl font-light italic tracking-tight">Coordinate Mismatch</h2>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">The requested intelligence does not exist</p>
                </div>

                <div className="p-8 bg-secondary/30 border border-border space-y-4">
                    <p className="text-[10px] text-muted-foreground leading-relaxed italic uppercase tracking-widest">
                        The transmission path you followed points to a decommissioned or non-existent sector.
                        To maintain system integrity, we are initiating a tactical retreat.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <BrandLoader size="sm" />
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-foreground italic">
                            Redirecting to {isAdmin ? 'Command Center' : 'Public Portal'} in {countdown}s
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => navigate(isAdmin ? "/admin" : "/")}
                        className="w-full py-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-xl shadow-black/10"
                    >
                        {isAdmin ? 'Return to Command' : 'Return Home'} <Home size={14} />
                    </button>
                    <button
                        onClick={() => navigate(-1)}
                        className="w-full py-4 border border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
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
