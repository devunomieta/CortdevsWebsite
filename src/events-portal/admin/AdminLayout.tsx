import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router";
import { Helmet } from "react-helmet-async";
import {
    LayoutDashboard,
    Bell,
    LogOut,
    ExternalLink,
    RefreshCw,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { adminFetch } from "../lib/api";
import { subscribeToChannel } from "../lib/realtime";
import { useToast } from "../../app/components/Toast";

export function EventsAdminLayout() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [userEmail, setUserEmail] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();

    const refreshUnreadCount = () => {
        adminFetch("/api/admin/events/notifications")
            .then((data) => setUnreadCount(data.unreadCount))
            .catch(() => { });
    };

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setIsAuthenticated(true);
                setUserEmail(session.user.email || "");
                refreshUnreadCount();
            } else {
                setIsAuthenticated(false);
                navigate("/admin/login");
            }
        };
        checkAuth();
    }, [navigate, location.pathname]);

    // Live notifications (export/import requests, retention reminders) — no
    // reload needed to see the badge update or a toast for what just happened.
    useEffect(() => {
        if (!isAuthenticated) return;
        return subscribeToChannel("admin-notifications", "update", (payload) => {
            refreshUnreadCount();
            if (payload?.title) showToast(payload.title, "info");
        });
    }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleLogout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem("events_admin_auth");
        navigate("/admin/login");
    };

    if (isAuthenticated === null) {
        return (
            <div className="bg-background min-h-screen flex flex-col items-center justify-center">
                <RefreshCw size={24} className="animate-spin text-primary mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Authenticating...
                </p>
            </div>
        );
    }

    const navigationItems = [
        { label: "Events", path: "/admin", icon: LayoutDashboard },
        { label: "Notifications", path: "/admin/notifications", icon: Bell, badge: unreadCount },
    ];

    return (
        <div className="bg-background min-h-screen flex">
            <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>

            <aside className="w-64 bg-card border-r border-border flex flex-col justify-between p-6 shrink-0">
                <div className="space-y-8">
                    <div className="flex items-center gap-3 border-b border-border pb-6">
                        <div className="w-9 h-9 bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">
                            EV
                        </div>
                        <div>
                            <span className="font-semibold text-sm block">Events Admin</span>
                            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold block">
                                Cortdevs Internal
                            </span>
                        </div>
                    </div>

                    <nav className="space-y-2">
                        {navigationItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`flex items-center justify-between gap-3 px-4 py-3 text-xs font-semibold transition-all ${isActive
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                        }`}
                                >
                                    <span className="flex items-center gap-3">
                                        <Icon size={16} />
                                        {item.label}
                                    </span>
                                    {!!item.badge && (
                                        <span
                                            className={`text-[10px] font-bold px-1.5 py-0.5 ${isActive ? "bg-primary-foreground text-primary" : "bg-destructive text-destructive-foreground"
                                                }`}
                                        >
                                            {item.badge}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="space-y-4 pt-6 border-t border-border">
                    <div className="px-3 py-2 bg-secondary">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Logged in as</p>
                        <p className="text-xs font-medium text-foreground truncate">{userEmail}</p>
                    </div>

                    <a
                        href="/"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                    >
                        <span>View Portal Home</span>
                        <ExternalLink size={12} />
                    </a>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-rose-500 hover:bg-rose-500/10 transition-colors font-semibold"
                    >
                        <LogOut size={16} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            <main className="flex-1 p-8 lg:p-12 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
}
