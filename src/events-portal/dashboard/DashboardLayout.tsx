import { useEffect, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router";
import { Helmet } from "react-helmet-async";
import { LogOut, Eye, ShieldCheck, RefreshCw } from "lucide-react";
import { eventFetch } from "../lib/api";
import { useConfig } from "../../app/context/ConfigContext";

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
    walkinFields: string[];
    days: EventDay[];
    timezone: string;
}

export function DashboardLayout() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { config } = useConfig();
    const [ctx, setCtx] = useState<DashboardContext | null | undefined>(undefined);

    useEffect(() => {
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
                setCtx({
                    token: stored.token,
                    label: data.session.label,
                    role: data.session.role,
                    slug: data.event.slug,
                    eventId: data.event.id,
                    eventTitle: data.event.title,
                    walkinFields: data.event.walkinFields || [],
                    days: data.days,
                    timezone: data.event.timezone || "UTC",
                });
            })
            .catch(() => {
                sessionStorage.removeItem("events_session");
                navigate(`/e/${slug}`);
            });
    }, [slug, navigate]);

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

    const isFull = ctx.role === "full";

    return (
        <div className="bg-background min-h-screen">
            <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>

            <header className="border-b border-border bg-card">
                <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <div className="flex items-center min-w-0">
                        <img src={config.headerLogo} alt="CortDevs" className="h-7 w-auto object-contain" />
                    </div>

                    <div className="text-center min-w-0 px-2">
                        <p className="text-sm font-medium truncate">{ctx.eventTitle}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                            Event Dashboard
                        </p>
                    </div>

                    <div className="flex items-center justify-end gap-4 min-w-0">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-secondary text-xs font-medium whitespace-nowrap">
                            {(ctx.role === "organizer" || ctx.role === "full") ? <ShieldCheck size={14} /> : <Eye size={14} />}
                            <span>{ctx.label}</span>
                            <span className="text-muted-foreground">· {ctx.role === "organizer" || ctx.role === "full" ? "Organizer" : ctx.role === "reception" ? "Reception" : "View only"}</span>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors whitespace-nowrap"
                        >
                            <LogOut size={14} /> Sign Out
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-10">
                <Outlet context={ctx} />
            </main>
        </div>
    );
}
