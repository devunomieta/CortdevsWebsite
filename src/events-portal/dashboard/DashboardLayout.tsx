import { useEffect, useState, useCallback } from "react";
import { Outlet, useNavigate, useParams } from "react-router";
import { Helmet } from "react-helmet-async";
import { LogOut, Eye, ShieldCheck, RefreshCw } from "lucide-react";
import { eventFetch } from "../lib/api";
import { subscribeToChannel } from "../lib/realtime";
import { useConfig } from "../../app/context/ConfigContext";
import { SlugMigrationModal } from "../components/SlugMigrationModal";

export interface EventDay {
    id: string;
    date: string;
    label: string;
}

export interface DashboardContext {
    token: string;
    label: string;
    role: "organizer" | "reception" | "view_only" | "full";
    slug: string;
    eventId: string;
    eventTitle: string;
    startDate: string | null;
    endDate: string | null;
    websiteUrl: string | null;
    description: string | null;
    bannerUrl: string | null;
    flierUrl: string | null;
    walkinFields: string[];
    days: EventDay[];
    timezone: string;
    refreshContext?: () => void;
}

export function DashboardLayout() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { config } = useConfig();
    const [ctx, setCtx] = useState<DashboardContext | null | undefined>(undefined);

    const loadContext = useCallback(() => {
        const raw = sessionStorage.getItem("events_session");
        const stored = raw ? JSON.parse(raw) : null;
        if (!stored || stored.slug !== slug || !stored.token) {
            navigate(`/e/${slug}`);
            return;
        }

        // Re-validate on every load — a revoked credential or disabled event
        // stops working here even if the cached token hasn't expired yet.
        eventFetch("/api/events/context", stored.token)
            .then((data) => {
                const updatedSession = {
                    ...stored,
                    event: data.event,
                    days: data.days,
                };
                sessionStorage.setItem("events_session", JSON.stringify(updatedSession));

                setCtx({
                    token: stored.token,
                    label: data.session.label,
                    role: data.session.role,
                    slug: data.event.slug,
                    eventId: data.event.id,
                    eventTitle: data.event.title,
                    startDate: data.event.startDate || null,
                    endDate: data.event.endDate || null,
                    websiteUrl: data.event.websiteUrl || null,
                    description: data.event.description || null,
                    bannerUrl: data.event.bannerUrl || null,
                    flierUrl: data.event.flierUrl || null,
                    walkinFields: data.event.walkinFields || [],
                    days: data.days,
                    timezone: data.event.timezone || "UTC",
                    refreshContext: loadContext,
                });
            })
            .catch(() => {
                sessionStorage.removeItem("events_session");
                navigate(`/e/${slug}`);
            });
    }, [slug, navigate]);

    useEffect(() => {
        loadContext();
    }, [loadContext]);

    const [slugMigration, setSlugMigration] = useState<{
        newSlug: string;
        newTitle: string;
        oldSlug: string;
        reason?: string;
    } | null>(null);

    // Live update when event details or schedule are modified
    useEffect(() => {
        if (!ctx?.eventId) return;
        return subscribeToChannel(`event-${ctx.eventId}`, "update", (payload) => {
            if (payload?.kind === "slug-changed") {
                setSlugMigration({
                    newSlug: payload.newSlug,
                    newTitle: payload.newTitle,
                    oldSlug: payload.oldSlug || slug || "",
                    reason: payload.reason,
                });
                return;
            }
            if (payload?.kind === "event-data") {
                loadContext();
            }
        });
    }, [ctx?.eventId, slug, loadContext]);

    const handleSignOut = () => {
        sessionStorage.removeItem("events_session");
        navigate(`/e/${slug}`);
    };

    if (ctx === undefined) {
        return (
            <div className="bg-background min-h-screen flex items-center justify-center">
                <RefreshCw size={22} className="animate-spin text-primary" />
            </div>
        );
    }
    if (ctx === null) return null;

    return (
        <div className="bg-background min-h-screen">
            <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>

            <header className="border-b border-border bg-card">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                    {/* Mobile layout: clean two-row design so elements never overlap */}
                    <div className="flex flex-col gap-2.5 md:hidden">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center shrink-0">
                                <img src={config.headerLogo} alt="CortDevs" className="h-6 w-auto object-contain" />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={handleSignOut}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap"
                                    title="Sign Out"
                                >
                                    <LogOut size={14} />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </div>

                        {/* Event Title Section on Mobile: Centralized, unclipped, with role underneath (hidden for view_only) */}
                        <div className="pt-2 border-t border-border/50 flex flex-col items-center text-center gap-1.5 px-1">
                            <h1 className="text-sm sm:text-base font-semibold text-foreground leading-snug break-words">
                                {ctx.eventTitle}
                            </h1>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">
                                    Event Dashboard
                                </span>
                                {ctx.role !== "view_only" && (
                                    <>
                                        <span className="text-muted-foreground/40 text-xs">·</span>
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-secondary text-[11px] font-medium rounded">
                                            {(ctx.role === "organizer" || ctx.role === "full") ? (
                                                <ShieldCheck size={12} className="text-primary shrink-0" />
                                            ) : (
                                                <Eye size={12} className="shrink-0" />
                                            )}
                                            <span className="text-foreground">{ctx.label}</span>
                                            <span className="text-muted-foreground font-normal">
                                                ({ctx.role === "organizer" || ctx.role === "full" ? "Organizer" : "Reception"})
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Desktop layout: balanced 3-column grid */}
                    <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] items-center gap-4">
                        <div className="flex items-center min-w-0">
                            <img src={config.headerLogo} alt="CortDevs" className="h-7 w-auto object-contain" />
                        </div>

                        <div className="text-center min-w-0 px-4 max-w-md mx-auto">
                            <p className="text-sm font-medium truncate text-foreground" title={ctx.eventTitle}>
                                {ctx.eventTitle}
                            </p>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                                Event Dashboard
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3 min-w-0">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-xs font-medium whitespace-nowrap">
                                {(ctx.role === "organizer" || ctx.role === "full") ? <ShieldCheck size={14} /> : <Eye size={14} />}
                                <span className="max-w-[130px] truncate">{ctx.label}</span>
                                <span className="text-muted-foreground">· {ctx.role === "organizer" || ctx.role === "full" ? "Organizer" : ctx.role === "reception" ? "Reception" : "View only"}</span>
                            </div>
                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap"
                                title="Sign Out"
                            >
                                <LogOut size={14} />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-10">
                <Outlet context={ctx} />
            </main>

            {slugMigration && (
                <SlugMigrationModal
                    oldSlug={slugMigration.oldSlug}
                    newSlug={slugMigration.newSlug}
                    newTitle={slugMigration.newTitle}
                    reason={slugMigration.reason}
                />
            )}
        </div>
    );
}
