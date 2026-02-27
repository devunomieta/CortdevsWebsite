import { motion } from "framer-motion";

interface BrandLoaderProps {
    className?: string;
    size?: "sm" | "md" | "lg";
}

export function BrandLoader({ className = "", size = "md" }: BrandLoaderProps) {
    const containerSizes = {
        sm: "gap-1.5",
        md: "gap-3",
        lg: "gap-4"
    };

    const boxSizes = {
        sm: "w-6 h-6 text-sm",
        md: "w-10 h-10 text-xl",
        lg: "w-14 h-14 text-2xl"
    };

    const textSizes = {
        sm: "text-lg",
        md: "text-2xl",
        lg: "text-4xl"
    };

    return (
        <div className={`flex items-center ${containerSizes[size]} ${className}`}>
            <motion.div
                animate={{
                    rotateY: [0, 180, 360],
                    scale: [1, 1.1, 1]
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className={`${boxSizes[size]} bg-black text-white flex items-center justify-center font-bold shadow-lg`}
            >
                C
            </motion.div>
            <div className="flex flex-col">
                <span className={`${textSizes[size]} font-light tracking-widest text-black`}>
                    CORT<span className="font-semibold text-black">DEVS</span>
                </span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 mt-1 font-medium">
                    Premium Web Solutions
                </span>
                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="h-[1px] bg-black/10 origin-left w-full mt-2"
                />
            </div>
        </div>
    );
}
