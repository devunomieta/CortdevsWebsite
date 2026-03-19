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
    Bell,
    BookOpen,
    AlertCircle,
    ChevronDown,
    Briefcase
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useConfig } from "../../context/ConfigContext";

function SidebarItem({ item, isSidebarOpen, pathname, isOpen, onToggle }: {
    item: any,
    isSidebarOpen: boolean,
    pathname: string,
    isOpen: boolean,
    onToggle: () => void
}) {
    const hasChildren = item.children && item.children.length > 0;
    const isActive = item.path === "/admin"
        ? pathname === "/admin"
        : item.path
            ? pathname.startsWith(item.path)
            : item.children?.some((child: any) => pathname.startsWith(child.path));

    if (!hasChildren) {
        return (
            <Link
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
    }

    return (
        <div className="space-y-1">
            <button
                onClick={onToggle}
                className={`w-full flex items-center justify-between p-3 transition-all group relative ${isActive ? "text-white" : "text-neutral-400 hover:text-white"
                    }`}
            >
                <div className="flex items-center gap-4">
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
                </div>
                {isSidebarOpen && (
                    <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-neutral-500 group-hover:text-white"
                    >
                        <ChevronDown size={14} />
                    </motion.div>
                )}
            </button>

            <AnimatePresence>
                {isOpen && isSidebarOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-1 ml-4 border-l border-white/10 pl-4"
                    >
                        {item.children.map((child: any) => {
                            const isChildActive = pathname === child.path;
                            return (
                                <Link
                                    key={child.path}
                                    to={child.path}
                                    className={`flex items-center gap-3 p-2 text-xs transition-all ${isChildActive ? "text-white font-bold" : "text-neutral-500 hover:text-white"
                                        }`}
                                >
                                    <div className={`w-1 h-1 rounded-full ${isChildActive ? "bg-white" : "bg-neutral-800"}`} />
                                    {child.label}
                                </Link>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function AdminLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
    const [unreadCount, setUnreadCount] = useState(0);
    const [userProfile, setUserProfile] = useState<{ role: string; permissions: string[] } | null>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { config } = useConfig();
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const pathname = location.pathname + location.search;

    useEffect(() => {
        const handleResize = () => {
            const desktop = window.innerWidth >= 1024;
            setIsDesktop(desktop);
            if (desktop) setIsMobileMenuOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchUnreadCount = async () => {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('read', false);

        if (!error && count !== null) setUnreadCount(count);
    };

    const fetchUserProfile = async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('role, permissions')
            .eq('id', userId)
            .single();

        if (!error && data) {
            setUserProfile(data);
        }
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
                fetchUserProfile(session.user.id);

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

        // Auto-open dropdown containing the active route
        const activeGroup = filteredMenu.find(item =>
            item.children?.some((child: any) => pathname.startsWith(child.path))
        );
        if (activeGroup) {
            setOpenDropdown(activeGroup.label);
        }
    }, [location.pathname]);

    const menuStructure = [
        { icon: <LayoutDashboard size={20} />, label: "Dashboard", path: "/admin", permission: "Dashboard" },
        { icon: <MessageSquare size={20} />, label: "Leads & Projects", path: "/admin/leads", permission: "Leads" },
        { icon: <Users size={20} />, label: "Clients", path: "/admin/clients", permission: "Clients" },
        {
            label: "Financials",
            icon: <DollarSign size={20} />,
            permission: "Transactions",
            children: [
                { label: "Project Ledger", path: "/admin/transactions?view=ledger" },
                { label: "Treasury", path: "/admin/transactions?view=treasury" },
                { label: "Commissions", path: "/admin/transactions?view=commissions" },
                { label: "Settlements", path: "/admin/transactions?view=confirmations" },
            ]
        },
        {
            label: "Communications",
            icon: <Mail size={20} />,
            permission: "Communications",
            children: [
                { label: "Mailbox", path: "/admin/comms?tab=mailbox" },
                { label: "Newsletter", path: "/admin/comms?tab=newsletter" },
                { label: "Templates", path: "/admin/comms?tab=templates" },
                { label: "Secure Relay", path: "/admin/comms?tab=smtp" },
            ]
        },
        {
            label: "Intelligence Hub",
            icon: <BarChart3 size={20} />,
            permission: "Intelligence",
            children: [
                { label: "Analytics Hub", path: "/admin/analytics" },
                { label: "Knowledge Base", path: "/knowledge-base" },
                { label: "Intel Submissions", path: "/admin/submissions" },
                { label: "Issue Reports", path: "/admin/issues" },
            ]
        },
        { icon: <ShieldCheck size={20} />, label: "Team & Roles", path: "/admin/users", permission: "Personnel" },
        { 
            label: "Careers",
            icon: <Briefcase size={20} />,
            permission: "Personnel",
            children: [
                { label: "Job Postings", path: "/admin/careers" },
                { label: "Applications", path: "/admin/applications" },
            ]
        },
        {
            label: "Site Settings",
            icon: <Settings size={20} />,
            permission: "Settings",
            children: [
                { label: "Platform Branding", path: "/admin/settings?view=branding" },
                { label: "Operational Intel", path: "/admin/settings?view=intel" },
                { label: "Global Commerce", path: "/admin/settings?view=billing" },
                { label: "Search Meta", path: "/admin/settings?view=meta" },
                { label: "Manage Records", path: "/admin/settings?view=records" },
            ]
        },
    ];

    const filteredMenu = menuStructure.filter(item => {
        if (!userProfile) return false;
        if (userProfile.role === 'Superadmin' || userProfile.role === 'Admin') return true;
        return userProfile.permissions?.includes(item.permission);
    });

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
                    <div className="bg-white/10 p-2 group-hover:bg-white/20 transition-all">
                        <img
                            src={config.footerLogo}
                            alt="Logo"
                            className={isSidebarOpen ? "h-5 w-auto" : "h-4 w-auto"}
                        />
                    </div>
                </div>

                <nav className="flex-1 mt-6 px-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {filteredMenu.map((item) => (
                        <SidebarItem
                            key={item.label}
                            item={item}
                            isSidebarOpen={isSidebarOpen}
                            pathname={pathname}
                            isOpen={openDropdown === item.label}
                            onToggle={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                        />
                    ))}
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
                                    <img src={config.footerLogo} alt="Logo" className="h-5 w-auto" />
                                </div>
                                <button onClick={() => setIsMobileMenuOpen(false)} className="text-neutral-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            <nav className="flex-1 mt-6 px-4 space-y-2 overflow-y-auto">
                                {filteredMenu.map((item) => (
                                    <SidebarItem
                                        key={item.label}
                                        item={item}
                                        isSidebarOpen={true}
                                        pathname={pathname}
                                        isOpen={openDropdown === item.label}
                                        onToggle={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                                    />
                                ))}
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
                            {filteredMenu.find(m => m.path === location.pathname)?.label ||
                                filteredMenu.find(m => m.children?.some((c: any) => c.path === location.pathname + location.search))?.label ||
                                "Dashboard"}
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

            {/* Desktop Only Restriction Overlay */}
            <AnimatePresence>
                {!isDesktop && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-8 text-center"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="max-w-xs space-y-6"
                        >
                            <div className="flex justify-center">
                                <Monitor size={64} className="text-white opacity-20" strokeWidth={1} />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-light italic text-white tracking-tight">Administrative Restriction</h2>
                                <p className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] font-bold">Optimal desktop environment required</p>
                            </div>
                            <p className="text-sm text-neutral-400 leading-relaxed font-light">
                                For security, operational density, and data integrity, the CortDevs Command Center is restricted to desktop displays.
                            </p>
                            <div className="pt-4 space-y-3">
                                <button
                                    onClick={() => navigate("/")}
                                    className="w-full py-4 bg-white text-black text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-neutral-200 transition-all"
                                >
                                    Return to Public Portal
                                </button>
                                <p className="text-[9px] text-neutral-600 uppercase tracking-[0.3em]">
                                    Switch to a 1024px+ display to proceed
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
