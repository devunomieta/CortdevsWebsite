import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard,
    Settings,
    Users,
    MessageSquare,
    Mail,
    LogOut,
    ShieldCheck,
    Menu,
    X,
    ChevronRight,
    Monitor,
    Database,
    DollarSign,
    BarChart3,
    Bell
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useConfig } from "../../context/ConfigContext";

export function AdminLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const location = useLocation();
    const navigate = useNavigate();
    const { config } = useConfig();

    const fetchUnreadCount = async () => {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('read', false);

        if (!error && count !== null) setUnreadCount(count);
    };

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const isAuth = localStorage.getItem("admin_auth");

            if ((!isAuth || !session) && location.pathname !== "/admin/login") {
                localStorage.removeItem("admin_auth");
                await supabase.auth.signOut();
                navigate("/admin/login");
                return;
            }

            if (session) {
                fetchUnreadCount();

                // Real-time listener for badge
                const channel = supabase
                    .channel('admin_notifications_badge')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
                        fetchUnreadCount();
                    })
                    .subscribe();

                return () => {
                    supabase.removeChannel(channel);
                };
            }
        };

        checkAuth();
    }, [location, navigate]);

    useEffect(() => {
        // Auto-close mobile menu on route change
        setIsMobileMenuOpen(false);
    }, [location]);

    const menuItems = [
        { icon: <LayoutDashboard size={20} />, label: "Dashboard", path: "/admin" },
        { icon: <MessageSquare size={20} />, label: "Leads & Projects", path: "/admin/leads" },
        { icon: <Users size={20} />, label: "Clients", path: "/admin/clients" },
        { icon: <DollarSign size={20} />, label: "Transactions", path: "/admin/transactions" },
        { icon: <BarChart3 size={20} />, label: "Analytics Hub", path: "/admin/analytics" },
        { icon: <Mail size={20} />, label: "Communications", path: "/admin/comms" },
        { icon: <ShieldCheck size={20} />, label: "Team & Roles", path: "/admin/users" },
        { icon: <Settings size={20} />, label: "Site Settings", path: "/admin/settings" },
    ];

    const handleLogout = () => {
        localStorage.removeItem("admin_auth");
        navigate("/admin/login");
    };

    return (
        <div className="flex h-screen bg-neutral-50 overflow-hidden font-sans">
            {/* Desktop Sidebar */}
            <motion.aside
                initial={false}
                animate={{
                    width: isSidebarOpen ? 280 : 80,
                    x: 0
                }}
                className="bg-black text-white h-screen flex flex-col relative z-30 shadow-2xl hidden lg:flex"
            >
                <div className="p-6 flex items-center gap-3 border-b border-white/10">
                    <div className="flex items-center justify-center">
                        <img
                            src={config.footerLogo}
                            alt="Logo"
                            className={isSidebarOpen ? "h-6 w-auto" : "h-5 w-auto"}
                        />
                    </div>
                </div>

                <nav className="flex-1 mt-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-4 p-3 transition-all group relative ${isActive ? "bg-white text-black" : "text-neutral-400 hover:text-white"
                                    }`}
                            >
                                <span className="shrink-0">{item.icon}</span>
                                {isSidebarOpen && (
                                    <motion.span
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-sm tracking-wide"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                                {isActive && (
                                    <motion.div
                                        layoutId="active-desktop"
                                        className="absolute inset-0 bg-white -z-10"
                                    />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-4 p-3 w-full text-neutral-400 hover:text-white transition-colors"
                    >
                        <LogOut size={20} />
                        {isSidebarOpen && <span className="text-sm">Logout</span>}
                    </button>
                </div>

                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="absolute -right-4 top-20 bg-black text-white p-1 rounded-full border border-white/10 flex"
                >
                    {isSidebarOpen ? <X size={14} /> : <Menu size={14} />}
                </button>
            </motion.aside>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden"
                        />
                        <motion.aside
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed top-0 left-0 bottom-0 w-[80%] max-w-[320px] bg-black text-white z-[110] flex flex-col lg:hidden shadow-3xl"
                        >
                            <div className="p-6 flex items-center justify-between border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <img src={config.footerLogo} alt="Logo" className="h-6 w-auto" />
                                </div>
                                <button onClick={() => setIsMobileMenuOpen(false)} className="text-neutral-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            <nav className="flex-1 mt-6 px-4 space-y-2 overflow-y-auto">
                                {menuItems.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={`flex items-center gap-4 p-4 transition-all ${isActive ? "bg-white text-black" : "text-neutral-400"}`}
                                        >
                                            <span className="shrink-0">{item.icon}</span>
                                            <span className="text-sm font-medium tracking-wide">{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>

                            <div className="p-6 border-t border-white/10">
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-4 p-4 w-full text-neutral-400 hover:text-white transition-colors"
                                >
                                    <LogOut size={20} />
                                    <span className="text-sm font-medium">Logout</span>
                                </button>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="h-20 bg-white border-b border-neutral-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 -ml-2 text-neutral-500 lg:hidden"
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-lg font-light text-neutral-500 truncate max-w-[150px] md:max-w-none">
                            {menuItems.find(m => m.path === location.pathname)?.label || "Dashboard"}
                        </h1>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-neutral-500 font-medium uppercase tracking-widest text-[10px]">System Online</span>
                        </div>

                        <Link
                            to="/admin/notifications"
                            className="relative w-10 h-10 border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-all group"
                        >
                            <Bell size={18} className="text-neutral-400 group-hover:text-black transition-colors" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-black text-white text-[10px] flex items-center justify-center font-bold">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </Link>

                        <Link
                            to="/admin/profile"
                            className="w-10 h-10 bg-neutral-100 border border-neutral-200 flex items-center justify-center rounded-full hover:bg-neutral-900 hover:text-white transition-all group"
                        >
                            <Users size={18} className="text-neutral-600 group-hover:text-white" />
                        </Link>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative custom-scrollbar">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
