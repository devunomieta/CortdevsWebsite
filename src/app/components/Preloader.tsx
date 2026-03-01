import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export function Preloader() {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
        }, 3000); // 2s core animation + 1s exit transition buffer
        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
            >
                <div className="relative flex flex-col items-center">
                    {/* Minimalist Text Logo */}
                    <div className="overflow-hidden">
                        <motion.h1
                            initial={{ y: "100%", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{
                                duration: 1.2,
                                ease: [0.16, 1, 0.3, 1],
                                delay: 0.2
                            }}
                            className="text-5xl md:text-7xl lg:text-8xl font-light text-white tracking-tighter text-center"
                        >
                            Cort<span className="font-semibold italic">Devs</span>
                        </motion.h1>
                    </div>

                    {/* Premium Subtext */}
                    <div className="mt-6 overflow-hidden">
                        <motion.p
                            initial={{ y: "100%", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
                            className="text-[10px] md:text-xs tracking-[0.5em] text-neutral-500 uppercase font-medium text-center"
                        >
                            Premium Web Solutions
                        </motion.p>
                    </div>

                    {/* Sleek Progress Track */}
                    <div className="mt-12 h-[1px] bg-white/5 overflow-hidden w-24 md:w-32">
                        <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: "0%" }}
                            transition={{ duration: 2, delay: 0.4, ease: [0.65, 0, 0.35, 1] }}
                            className="h-full bg-white origin-left"
                        />
                    </div>
                </div>

                {/* Ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none" />
            </motion.div>
        </AnimatePresence>
    );
}
