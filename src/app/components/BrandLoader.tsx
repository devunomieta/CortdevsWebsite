import { motion } from "framer-motion";

interface BrandLoaderProps {
    className?: string;
    size?: "sm" | "md" | "lg";
}

export function BrandLoader({ className = "", size = "md" }: BrandLoaderProps) {
    const textSizes = {
        sm: "text-xl md:text-2xl",
        md: "text-3xl md:text-4xl",
        lg: "text-4xl md:text-6xl"
    };

    const subtextSizes = {
        sm: "text-[8px] md:text-[9px]",
        md: "text-[9px] md:text-[10px]",
        lg: "text-[10px] md:text-xs"
    };

    return (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="flex flex-col items-center"
            >
                <h2 className={`${textSizes[size]} font-light tracking-tighter text-black`}>
                    Cort<span className="font-semibold italic">Devs</span>
                </h2>
                <div className="overflow-hidden">
                    <motion.span 
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className={`${subtextSizes[size]} tracking-[0.4em] uppercase text-neutral-500 mt-2 font-medium text-center block`}
                    >
                        Premium Web Solutions
                    </motion.span>
                </div>
                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="h-[1px] bg-black/10 origin-center w-12 md:w-16 mt-4"
                />
            </motion.div>
        </div>
    );
}
