import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router";
import { Helmet } from "react-helmet-async";
import { LayoutDashboard, Layers, ClipboardList, Users, Scale, Wallet, Receipt, LifeBuoy, ScrollText, Settings, LogOut, ExternalLink, RefreshCw, Menu, X, MessageSquarePlus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { SplitSubsMark } from "../components/SplitSubsLogo";

export function SplitSubsAdminLayout() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [userEmail, setUserEmail] = useState("");
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setIsAuthenticated(true);
                setUserEmail(session.user.email || "");
            } else {
                setIsAuthenticated(false);
                navigate("/admin/login");
            }
        };
        checkAuth();
    }, [navigate, location.pathname]);

    useEffect(() => { setIsMenuOpen(false); }, [location.pathname]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/admin/login");
    };

    if (isAuthenticated === null) {
        return (
            <div className="bg-background min-h-screen flex flex-col items-center justify-center">
                <RefreshCw size={24} className="animate-spin text-primary mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Authenticating...</p>
            </div>
        );
    }
    if (!isAuthenticated) return null;

    const navigationItems = [
        { label: "Overview", path: "/admin", icon: LayoutDashboard },
        { label: "Catalog", path: "/admin/catalog", icon: Layers },
        { label: "Listings", path: "/admin/listings", icon: ClipboardList },
        { label: "Users", path: "/admin/hosts", icon: Users },
        { label: "Disputes", path: "/admin/disputes", icon: Scale },
        { label: "Transactions", path: "/admin/transactions", icon: Receipt },
        { label: "Payouts", path: "/admin/settlements", icon: Wallet },
        { label: "Tickets", path: "/admin/tickets", icon: LifeBuoy },
        { label: "Service Requests", path: "/admin/service-requests", icon: MessageSquarePlus },
        { label: "Audit Log", path: "/admin/audit-log", icon: ScrollText },
        { label: "Settings", path: "/admin/settings", icon: Settings },
    ];

    const activeLabel = navigationItems.find((i) => i.path === location.pathname)?.label || "Admin";

    const sidebarContent = (
        <>
            <div className="space-y-8">
                <div className="flex items-center justify-between gap-3 border-b border-border pb-6">
                    <div className="flex items-center gap-3">
                        <SplitSubsMark className="w-9 h-9 text-primary shrink-0" />
                        <div>
                            <span className="font-semibold text-sm block">SplitSubs Admin</span>
                            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold block">Cortdevs Internal</span>
                        </div>
                    </div>
                    <button onClick={() => setIsMenuOpen(false)} className="lg:hidden p-1 text-muted-foreground hover:text-foreground" aria-label="Close menu">
                        <X size={20} />
                    </button>
                </div>

                <nav className="space-y-1">
                    {navigationItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-2.5 text-xs font-semibold transition-all ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                                <Icon size={15} />
                                {item.label}
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
                <a href="/" target="_blank" rel="noreferrer" className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <span>View Portal Home</span>
                    <ExternalLink size={12} />
                </a>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-destructive hover:bg-destructive/10 transition-colors font-semibold">
                    <LogOut size={16} />
                    <span>Sign Out</span>
                </button>
            </div>
        </>
    );

    return (
        <div className="bg-background h-screen flex overflow-hidden">
            <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>

            {/* Desktop/tablet sidebar — always visible from lg up */}
            <aside className="hidden lg:flex w-64 bg-card border-r border-border flex-col justify-between p-6 shrink-0 overflow-y-auto">
                {sidebarContent}
            </aside>

            {/* Mobile drawer — off-canvas below lg, toggled by the header's menu button */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsMenuOpen(false)} />
            )}
            <aside className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-card border-r border-border flex flex-col justify-between p-6 overflow-y-auto transition-transform duration-200 lg:hidden ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
                {sidebarContent}
            </aside>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="lg:hidden flex items-center justify-between px-4 py-4 border-b border-border bg-card shrink-0">
                    <button onClick={() => setIsMenuOpen(true)} className="p-2 -ml-2 text-foreground" aria-label="Open menu">
                        <Menu size={22} />
                    </button>
                    <span className="font-semibold text-sm truncate">{activeLabel}</span>
                    <div className="w-8" />
                </header>

                <main className="flex-1 p-4 sm:p-6 lg:p-12 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
