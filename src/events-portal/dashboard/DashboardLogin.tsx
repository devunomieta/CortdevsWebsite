import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { Lock, Mail, ArrowRight, RefreshCw, CalendarDays, Eye, EyeOff, Calendar, Sparkles } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useToast } from "../../app/components/Toast";
import { ApiError } from "../lib/api";

interface EventPublicInfo {
    id: string;
    title: string;
    slug: string;
    flierUrl: string | null;
    bannerUrl: string | null;
    startDate: string | null;
    endDate: string | null;
    description: string | null;
}

export function DashboardLogin() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const [eventInfo, setEventInfo] = useState<EventPublicInfo | null>(null);
    const [isFetchingInfo, setIsFetchingInfo] = useState(true);

    // Fetch public event information (title, flier, dates)
    useEffect(() => {
        if (!slug) return;
        let isMounted = true;
        setIsFetchingInfo(true);

        fetch(`/api/events/info?slug=${encodeURIComponent(slug)}`)
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!isMounted) return;
                if (!res.ok) {
                    if (res.status === 404 || res.status === 403) {
                        setLoadError(data.error || "This link is not active.");
                    }
                    return;
                }
                setEventInfo(data);
            })
            .catch(() => {
                // If info call fails, fallback to rendering basic login without blocking
            })
            .finally(() => {
                if (isMounted) setIsFetchingInfo(false);
            });

        return () => {
            isMounted = false;
        };
    }, [slug]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setLoadError(null);

        try {
            const res = await fetch("/api/events/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug, email, password }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                if (res.status === 404) {
                    setLoadError(data.error || "This link isn't active.");
                    return;
                }
                showToast(data.error || "Something went wrong. Please try again.", "error");
                return;
            }

            sessionStorage.setItem(
                "events_session",
                JSON.stringify({ token: data.token, session: data.session, event: data.event, days: data.days, slug })
            );
            showToast(`Welcome, ${data.session.label}.`, "success");
            navigate(`/e/${slug}/dashboard`);
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Network error. Please try again.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    if (loadError) {
        return (
            <div className="bg-background min-h-screen flex flex-col justify-center items-center p-6 text-center">
                <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Not Available</p>
                <h1 className="text-2xl font-light tracking-tight mb-4">{loadError}</h1>
                <p className="text-muted-foreground text-sm max-w-sm mb-8">
                    Double-check the link your admin sent, or reach out if you think this is a mistake.
                </p>
                <Link to="/contact" className="text-xs font-bold uppercase tracking-widest hover:opacity-70">
                    Contact Cortdevs →
                </Link>
            </div>
        );
    }

    if (isFetchingInfo && !eventInfo) {
        return (
            <div className="bg-background min-h-screen flex items-center justify-center">
                <RefreshCw size={24} className="animate-spin text-primary" />
            </div>
        );
    }

    const hasFlier = !!eventInfo?.flierUrl;
    const eventTitle = eventInfo?.title || "Event Dashboard";

    return (
        <div className="bg-background min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12">
            <Helmet>
                <title>{eventTitle} — Login | CortDevs Events</title>
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>

            <div className={`w-full ${hasFlier ? "max-w-4xl lg:max-w-5xl" : "max-w-md"} border border-border bg-card shadow-xl overflow-hidden transition-all duration-300`}>
                <div className={`grid grid-cols-1 ${hasFlier ? "md:grid-cols-12" : ""}`}>
                    {/* Event Flier Column (Clean, natural containment without black letterboxing) */}
                    {hasFlier && (
                        <div className="md:col-span-6 lg:col-span-6 bg-muted/40 p-6 sm:p-8 lg:p-10 flex items-center justify-center border-b md:border-b-0 md:border-r border-border">
                            <div className="relative w-full max-w-sm flex items-center justify-center">
                                <img
                                    src={eventInfo.flierUrl!}
                                    alt={`${eventTitle} Flier`}
                                    className="w-full h-auto max-h-[520px] object-contain shadow-lg border border-border/80"
                                    loading="eager"
                                />
                            </div>
                        </div>
                    )}

                    {/* Login Form Column */}
                    <div className={`${hasFlier ? "md:col-span-6 lg:col-span-6" : "w-full"} p-8 sm:p-10 lg:p-12 flex flex-col justify-center space-y-7 bg-card`}>
                        <div className="text-center space-y-2">
                            <div className="w-11 h-11 bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                                {hasFlier ? <Sparkles size={20} /> : <CalendarDays size={22} />}
                            </div>
                            <h1 className="text-2xl font-light tracking-tight text-foreground line-clamp-2">
                                {eventTitle}
                            </h1>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                Private Event Portal Login
                            </p>
                            {/* Event dates moved under the title on the login form */}
                            {eventInfo?.startDate && (
                                <p className="text-xs font-medium text-foreground/80 pt-1 flex items-center justify-center gap-1.5 font-mono">
                                    <Calendar size={13} className="text-muted-foreground shrink-0" />
                                    <span>
                                        {eventInfo.startDate}
                                        {eventInfo.endDate && eventInfo.endDate !== eventInfo.startDate ? ` → ${eventInfo.endDate}` : ""}
                                    </span>
                                </p>
                            )}
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Login Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="email"
                                        required
                                        placeholder="you@yourevent.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        placeholder="••••••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-10 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        tabIndex={-1}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow"
                            >
                                {isLoading ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" /> Checking...
                                    </>
                                ) : (
                                    <>
                                        Enter Dashboard <ArrowRight size={14} />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="pt-4 border-t border-border text-center">
                            <Link to="/contact" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                                Trouble logging in? Contact Cortdevs
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

