import { useId } from "react";
import { Link } from "react-router";

// The mark: a rounded tile cut diagonally in two — one half solid, one half
// faint. Reads as "one subscription, split in two" at any size, and inherits
// its color from the surrounding text (`currentColor`), so the same SVG
// works on the light navbar and the dark footer without a second asset.
export function SplitSubsMark({ className }: { className?: string }) {
    const clipId = useId();
    return (
        <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
                <clipPath id={clipId}>
                    <rect x="0" y="0" width="32" height="32" rx="9" />
                </clipPath>
            </defs>
            <rect x="0" y="0" width="32" height="32" rx="9" fill="currentColor" fillOpacity="0.16" />
            <polygon points="0,0 32,0 32,32" fill="currentColor" clipPath={`url(#${clipId})`} />
        </svg>
    );
}

export function SplitSubsLogo({ className = "", iconClassName = "h-7 w-7", wordmarkClassName = "text-lg", to = "/" }: {
    className?: string;
    iconClassName?: string;
    wordmarkClassName?: string;
    to?: string;
}) {
    return (
        <Link to={to} className={`flex items-center gap-2 shrink-0 ${className}`}>
            <SplitSubsMark className={iconClassName} />
            <span className={`font-semibold tracking-tight ${wordmarkClassName}`}>
                split<span className="opacity-50">subs</span>
            </span>
        </Link>
    );
}
