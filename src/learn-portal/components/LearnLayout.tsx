import React from 'react';
import { Link, NavLink, Outlet, Navigate, useLocation } from 'react-router';
import { Award, BookOpen, Flame, LogOut, Settings, ShieldCheck, Loader2 } from 'lucide-react';
import { useLearnAuth } from '../context/LearnAuthContext';
import { CortDevsLearnLogo } from './BrandLogos';

export function LearnLayout() {
    const { loading, user, enrollment, authError, isAdmin, signOut } = useLearnAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen bg-white text-neutral-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <CortDevsLearnLogo size="md" />
                    <div className="flex items-center gap-2 text-neutral-500 text-xs uppercase tracking-[0.2em]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-950" />
                        <span>Loading Cohort Workspace</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
    }

    if (!enrollment) {
        return (
            <div className="min-h-screen bg-neutral-50 text-neutral-950 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white border border-neutral-200 p-8 text-center space-y-5 shadow-sm">
                    <div className="flex justify-center">
                        <CortDevsLearnLogo size="md" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-xl font-semibold tracking-tight">Access Restricted</h1>
                        <p className="text-sm text-neutral-600">
                            {authError || 'Your account does not currently have active access to this learning portal. Contact your CortDevs administrator.'}
                        </p>
                    </div>
                    <p className="text-xs text-neutral-500">Signed in as {user.email}</p>
                    <button
                        onClick={signOut}
                        className="w-full py-3 px-4 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.2em] transition"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    const navItemClass = ({ isActive }: { isActive: boolean }) =>
        `inline-flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-[0.16em] transition ${
            isActive
                ? 'text-neutral-950 font-bold border-b-2 border-neutral-950'
                : 'text-neutral-500 hover:text-neutral-950 font-medium'
        }`;

    return (
        <div className="min-h-screen bg-neutral-50/60 text-neutral-950 flex flex-col font-sans overflow-x-hidden">
            <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 sm:gap-8 min-w-0">
                        <Link to="/dashboard" className="group transition-opacity hover:opacity-85 shrink-0">
                            <CortDevsLearnLogo size="sm" />
                        </Link>

                        <nav className="hidden md:flex items-center gap-6">
                            <NavLink to="/dashboard" className={navItemClass}>
                                <BookOpen className="w-3.5 h-3.5" />
                                Course
                            </NavLink>
                            <NavLink to="/certificate" className={navItemClass}>
                                <Award className="w-3.5 h-3.5" />
                                Certificate
                            </NavLink>
                            <NavLink to="/settings" className={navItemClass}>
                                <Settings className="w-3.5 h-3.5" />
                                Reminders
                            </NavLink>
                            {isAdmin && (
                                <NavLink to="/admin" className={navItemClass}>
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Admin
                                </NavLink>
                            )}
                        </nav>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <div
                            title="Daily study streak"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 border border-neutral-200 text-neutral-900 text-xs font-semibold"
                        >
                            <Flame className="w-3.5 h-3.5 text-amber-600" />
                            <span>{enrollment.current_streak || 0}d</span>
                            <span className="hidden sm:inline">streak</span>
                        </div>

                        <div className="hidden sm:flex flex-col text-right leading-tight pl-2 border-l border-neutral-200">
                            <span className="text-xs font-semibold text-neutral-900">{enrollment.full_name}</span>
                            <span className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">
                                {enrollment.role}
                            </span>
                        </div>

                        <button
                            onClick={signOut}
                            title="Sign out"
                            aria-label="Sign out"
                            className="p-2 text-neutral-500 hover:text-neutral-950 hover:bg-neutral-100 transition"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Mobile quick nav */}
                <div className="md:hidden border-t border-neutral-200 px-3 py-2 flex items-center justify-around gap-2 bg-white overflow-x-auto">
                    <NavLink to="/dashboard" className={navItemClass}>
                        <BookOpen className="w-3.5 h-3.5" /> Course
                    </NavLink>
                    <NavLink to="/certificate" className={navItemClass}>
                        <Award className="w-3.5 h-3.5" /> Cert
                    </NavLink>
                    <NavLink to="/settings" className={navItemClass}>
                        <Settings className="w-3.5 h-3.5" /> Alerts
                    </NavLink>
                    {isAdmin && (
                        <NavLink to="/admin" className={navItemClass}>
                            <ShieldCheck className="w-3.5 h-3.5" /> Admin
                        </NavLink>
                    )}
                </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Outlet />
            </main>

            <footer className="border-t border-neutral-200 bg-white mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-500">
                    <span>© {new Date().getFullYear()} CortDevs · Private Internal Learning Portal</span>
                    <span className="text-[11px] tracking-[0.12em] uppercase">Microsoft AI Product Manager Cohort</span>
                </div>
            </footer>
        </div>
    );
}
