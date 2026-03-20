import React from "react";
import { motion } from "framer-motion";
import { Hammer, Settings, ShieldAlert } from "lucide-react";
import { BrandLoader } from "../components/BrandLoader";

export function Maintenance() {
    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
            {/* Background Decorative Element */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-secondary/20 rounded-full blur-3xl opacity-50 z-0" />

            <div className="max-w-md w-full text-center relative z-10 space-y-12">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="flex justify-center"
                >
                    <div className="relative">
                        <div className="w-32 h-32 border border-border flex items-center justify-center bg-card">
                            <Settings size={48} className="text-foreground animate-spin-slow" strokeWidth={1} />
                        </div>
                        <div className="absolute -bottom-4 -right-4 bg-primary p-3 text-primary-foreground">
                            <Hammer size={20} />
                        </div>
                    </div>
                </motion.div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-light italic tracking-tight">System Core Maintenance</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.4em] font-bold">Orbital Synchronization in Progress</p>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed font-light px-4">
                        We are currently performing critical intelligence upgrades to our infrastructure.
                        The public portal is temporarily offline to ensure data synchronization and security integrity.
                    </p>
                </div>

                <div className="p-8 bg-secondary/30 border border-border space-y-6">
                    <div className="flex items-center justify-center gap-4">
                        <BrandLoader size="sm" />
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-foreground italic">
                            System Optimizing...
                        </span>
                    </div>

                    <div className="flex items-start gap-4 text-left border-t border-border pt-6">
                        <ShieldAlert size={24} className="text-muted/30 shrink-0" />
                        <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                            Rest assured, all client project dossiers and active transmissions are encrypted and secure.
                            Normal operations will resume shortly.
                        </p>
                    </div>
                </div>

                <div className="space-y-4 pt-8">
                    <p className="text-[9px] text-neutral-300 uppercase tracking-[0.6em]">
                        CORTDEVS_INFRASTRUCTURE_V4.0
                    </p>
                    <div className="flex justify-center gap-8 opacity-20 hover:opacity-100 transition-opacity">
                        <div className="w-1 h-1 bg-black rounded-full" />
                        <div className="w-1 h-1 bg-black rounded-full" />
                        <div className="w-1 h-1 bg-black rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Add CSS keyframe for slow spin if not present in global CSS
// .animate-spin-slow { animation: spin 8s linear infinite; }
