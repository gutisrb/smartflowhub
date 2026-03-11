import React from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface GlassCardProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    gradient?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
    ({ children, className, gradient = false, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                    "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-500",
                    "hover:border-emerald/30 hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.2)]",
                    gradient && "bg-gradient-to-br from-white/10 to-transparent",
                    className
                )}
                {...props}
            >
                {/* Subtle Inner Glow */}
                <div className="absolute inset-px rounded-[15px] bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                <div className="relative z-10">{children}</div>
            </motion.div>
        );
    }
);

GlassCard.displayName = "GlassCard";
