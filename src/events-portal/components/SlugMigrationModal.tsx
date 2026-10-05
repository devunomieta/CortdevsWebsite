import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Copy, Check, ArrowRight } from "lucide-react";

interface SlugMigrationModalProps {
    oldSlug: string;
    newSlug: string;
    newTitle: string;
    reason?: string;
}

export function SlugMigrationModal({ oldSlug, newSlug, newTitle, reason }: SlugMigrationModalProps) {
    const [secondsLeft, setSecondsLeft] = useState(12);
    const [copied, setCopied] = useState(false);

    // Build the full URL for the new login portal
    const newPortalPath = `/e/${newSlug}`;
    const fullNewPortalUrl = typeof window !== "undefined"
        ? `${window.location.origin}${newPortalPath}`
        : newPortalPath;

    const handleRedirect = useCallback(() => {
        // Clear stored credential session to ensure no stale token usage
        sessionStorage.removeItem("events_session");

        // Open the new portal login in a fresh tab
        window.open(fullNewPortalUrl, "_blank", "noopener,noreferrer");

        // Redirect current tab to the base events directory or landing page to avoid staying on stale route
        window.location.href = `/e/${newSlug}`;
    }, [fullNewPortalUrl, newSlug]);

    const handleCopy = () => {
        navigator.clipboard.writeText(fullNewPortalUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        });
    };

    useEffect(() => {
        if (secondsLeft <= 0) {
            handleRedirect();
            return;
        }

        const timer = setInterval(() => {
            setSecondsLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [secondsLeft, handleRedirect]);

    return (
        <div
            className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300"
            role="alertdialog"
            aria-modal="true"
        >
            <div className="bg-card border border-border max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-6">
                {/* Header Icon + Notice */}
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                Event URL Updated
                            </span>
                            <span className="text-xs text-muted-foreground">
                                Redirecting in {secondsLeft}s
                            </span>
                        </div>
                        <h2 className="text-xl font-bold tracking-tight mt-1 text-foreground">
                            Session Migration Required
                        </h2>
                    </div>
                </div>

                {/* Description Body */}
                <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                    <p>
                        The event title has been renamed to{" "}
                        <strong className="text-foreground font-semibold">"{newTitle}"</strong>.
                        To maintain secure link structure, this event's portal address has changed.
                    </p>
                    {reason && (
                        <p className="text-xs bg-muted/60 p-2.5 border-l-2 border-primary text-foreground/90 font-mono">
                            {reason}
                        </p>
                    )}
                </div>

                {/* URL comparison block */}
                <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Previous URL:</span>
                        <span className="line-through font-mono opacity-70">/e/{oldSlug}/dashboard</span>
                    </div>
                    <div className="p-3 bg-secondary/80 border border-border flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <span className="block font-semibold text-emerald-600 dark:text-emerald-400 text-[10px] uppercase tracking-wider">
                                New Portal Address
                            </span>
                            <span className="font-mono text-foreground font-medium truncate block text-xs">
                                {fullNewPortalUrl}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-background border border-border text-xs font-medium hover:bg-muted transition-colors shrink-0"
                            title="Copy new URL"
                        >
                            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            <span>{copied ? "Copied" : "Copy"}</span>
                        </button>
                    </div>
                </div>

                {/* Action button */}
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={handleRedirect}
                        className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity shadow cursor-pointer"
                    >
                        <span>Open New Portal & Sign In</span>
                        <ArrowRight size={15} />
                    </button>
                    <p className="text-[11px] text-center text-muted-foreground mt-2">
                        Clicking opens the new portal in a new tab and safely logs you out of this session.
                    </p>
                </div>
            </div>
        </div>
    );
}
