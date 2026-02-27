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
    Database
} from "lucide-react";

export function AdminLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const isAuth = localStorage.getItem("admin_auth");
        if (!isAuth && location.pathname !== "/admin/login") {
            navigate("/admin/login");
        }
    }, [location, navigate]);

    const menuItems = [
        { icon: <LayoutDashboard size={20} />, label: "Dashboard", path: "/admin" },
        { icon: <MessageSquare size={20} />, label: "Leads & Projects", path: "/admin/leads" },
        { icon: <Users size={20} />, label: "Clients", path: "/admin/clients" },
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
            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: isSidebarOpen ? 280 : 80 }}
                className="bg-black text-white h-screen flex flex-col relative z-20 shadow-2xl"
            >
                <div className="p-6 flex items-center gap-3 border-b border-white/10">
                    <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-bold">C</div>
                    {isSidebarOpen && (
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="font-light tracking-tighter text-xl"
                        >
                            Cort<span className="font-semibold">Admin</span>
                        </motion.span>
                    )}
                </div>

                <nav className="flex-1 mt-6 px-4 space-y-2">
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
                                        layoutId="active"
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
                    className="absolute -right-4 top-20 bg-black text-white p-1 rounded-full border border-white/10 md:flex hidden"
                >
                    {isSidebarOpen ? <X size={14} /> : <Menu size={14} />}
                </button>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="h-20 bg-white border-b border-neutral-200 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-light text-neutral-500">
                            {menuItems.find(m => m.path === location.pathname)?.label || "Dashboard"}
                        </h1>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-neutral-500 font-medium uppercase tracking-widest text-[10px]">System Online</span>
                        </div>
                        <Link
                            to="/admin/profile"
                            className="w-10 h-10 bg-neutral-100 border border-neutral-200 flex items-center justify-center rounded-full hover:bg-neutral-900 hover:text-white transition-all group"
                        >
                            <Users size={18} className="text-neutral-600 group-hover:text-white" />
                        </Link>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 relative">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
