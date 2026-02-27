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
                    {/* Animated Text */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{
                            duration: 1,
                            ease: [0.16, 1, 0.3, 1],
                            delay: 0.2
                        }}
                        className="flex items-center gap-6"
                    >
                        <motion.div
                            initial={{ scale: 0.8, rotate: -15, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{ duration: 1.2, delay: 0.1, ease: "easeOut" }}
                            className="w-20 h-20 bg-white text-black flex items-center justify-center font-bold text-5xl shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                        >
                            C
                        </motion.div>
                        <div className="overflow-hidden">
                            <motion.span
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                className="text-6xl lg:text-8xl font-light text-white tracking-tighter block"
                            >
                                Cort<span className="font-semibold italic">Devs</span>
                            </motion.span>
                        </div>
                    </motion.div>

                    {/* Speed Message */}
                    <div className="mt-12 overflow-hidden h-6">
                        <motion.p
                            initial={{ y: "100%", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.6, delay: 1.2, ease: "easeOut" }}
                            className="text-xs tracking-[0.4em] text-neutral-500 uppercase font-medium"
                        >
                            Instant Load. Speed as Promised.
                        </motion.p>
                    </div>

                    {/* Luxurious Progress Track */}
                    <div className="absolute -bottom-16 left-0 right-0 h-[2px] bg-white/5 overflow-hidden w-full max-w-[320px] mx-auto">
                        <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: "0%" }}
                            transition={{ duration: 2.5, delay: 0.5, ease: [0.65, 0, 0.35, 1] }}
                            className="h-full bg-white origin-left shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                        />
                    </div>
                </div>

                {/* Ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none" />
            </motion.div>
        </AnimatePresence>
    );
}
