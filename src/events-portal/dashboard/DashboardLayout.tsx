import { useEffect, useState } from "react";
import { Outlet, useNavigate, useParams, Link, useLocation } from "react-router";
import { Helmet } from "react-helmet-async";
import { LogOut, CalendarDays, Eye, ShieldCheck, RefreshCw } from "lucide-react";
import { eventFetch } from "../lib/api";

export interface EventDay {
    id: string;
    date: string;
    label: string;
}

export interface DashboardContext {
    token: string;
    label: string;
    role: "full" | "view_only";
    slug: string;
    eventId: string;
    eventTitle: string;
    walkinFields: string[];
    days: EventDay[];
}

export function DashboardLayout() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
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
    const tabs = isFull
        ? [{ to: `/e/${slug}/dashboard`, label: "Check-in & Stats" }]
        : [{ to: `/e/${slug}/dashboard`, label: "Stats" }];

    return (
        <div className="bg-background min-h-screen">
            <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>

            <header className="border-b border-border bg-card">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                            <CalendarDays size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{ctx.eventTitle}</p>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                                Event Dashboard
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-secondary text-xs font-medium">
                            {isFull ? <ShieldCheck size={14} /> : <Eye size={14} />}
                            <span>{ctx.label}</span>
                            <span className="text-muted-foreground">· {isFull ? "Full access" : "View only"}</span>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors"
                        >
                            <LogOut size={14} /> Sign Out
                        </button>
                    </div>
                </div>

                <nav className="max-w-6xl mx-auto px-6 flex gap-6 border-t border-border">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.to}
                            to={tab.to}
                            className={`text-xs font-bold uppercase tracking-widest py-3 border-b-2 transition-colors ${location.pathname === tab.to
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {tab.label}
                        </Link>
                    ))}
                </nav>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-10">
                <Outlet context={ctx} />
            </main>
        </div>
    );
}
