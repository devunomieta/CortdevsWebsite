import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { Lock, Mail, ArrowRight, RefreshCw, CalendarDays } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useToast } from "../../app/components/Toast";
import { ApiError } from "../lib/api";

export function DashboardLogin() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

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

    return (
        <div className="bg-background min-h-screen flex flex-col justify-center items-center p-6">
            <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
            <div className="w-full max-w-md border border-border p-8 lg:p-10 bg-card space-y-8">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                        <CalendarDays size={26} />
                    </div>
                    <h1 className="text-2xl font-light tracking-tight">Event Dashboard</h1>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                        Private Login
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
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
                                type="password"
                                required
                                placeholder="••••••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
    );
}
