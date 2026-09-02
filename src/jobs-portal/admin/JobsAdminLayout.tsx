import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router';
import { supabase } from '../../lib/supabase';
import {
    Briefcase,
    Users,
    LayoutDashboard,
    LogOut,
    ShieldAlert,
    ExternalLink,
    RefreshCw,
    PlusCircle
} from 'lucide-react';

export function JobsAdminLayout() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [userEmail, setUserEmail] = useState<string>('');
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setIsAuthenticated(true);
                setUserEmail(session.user.email || '');
            } else {
                setIsAuthenticated(false);
                navigate('/admin/login');
            }
        };

        checkAuth();
    }, [navigate]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('jobs_admin_auth');
        navigate('/admin/login');
    };

    if (isAuthenticated === null) {
        return (
            <div className="bg-background min-h-screen flex flex-col items-center justify-center">
                <RefreshCw size={24} className="animate-spin text-primary mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Authenticating Jobs Command Center...</p>
            </div>
        );
    }

    const navigationItems = [
        { label: 'Overview', path: '/admin', icon: LayoutDashboard },
        { label: 'Vacancies Manager', path: '/admin/vacancies', icon: Briefcase },
        { label: 'Applicants & CVs', path: '/admin/candidates', icon: Users },
    ];

    return (
        <div className="bg-background min-h-screen flex">
            {/* Dedicated Jobs Admin Sidebar */}
            <aside className="w-64 bg-card border-r border-border flex flex-col justify-between p-6 shrink-0">
                <div className="space-y-8">
                    <div className="flex items-center gap-3 border-b border-border pb-6">
                        <div className="w-9 h-9 bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center rounded-lg">
                            JP
                        </div>
                        <div>
                            <span className="font-semibold text-sm block">Jobs Admin</span>
                            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold block">Recruitment Suite</span>
                        </div>
                    </div>

                    <nav className="space-y-2">
                        {navigationItems.map(item => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-lg transition-all ${
                                        isActive
                                            ? 'bg-primary text-primary-foreground shadow-md'
                                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                    }`}
                                >
                                    <Icon size={16} />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="space-y-4 pt-6 border-t border-border">
                    <div className="px-3 py-2 bg-secondary rounded-lg">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Logged in as</p>
                        <p className="text-xs font-medium text-foreground truncate">{userEmail}</p>
                    </div>

                    <a
                        href="/"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                    >
                        <span>View Public Board</span>
                        <ExternalLink size={12} />
                    </a>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors font-semibold"
                    >
                        <LogOut size={16} />
                        <span>Sign Out Recruiter</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-8 lg:p-12 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
}
