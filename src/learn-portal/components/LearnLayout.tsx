import React from 'react';
import { Link, NavLink, Outlet, Navigate, useLocation } from 'react-router';
import { BookOpen, Flame, GraduationCap, LogOut, Settings, ShieldCheck, Loader2 } from 'lucide-react';
import { useLearnAuth } from '../context/LearnAuthContext';

export function LearnLayout() {
    const { loading, user, enrollment, cohort, authError, isAdmin, signOut } = useLearnAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
                <div className="flex items-center gap-3 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                    <span className="text-sm font-medium">Loading your cohort workspace...</span>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
    }

    if (!enrollment) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
                        <GraduationCap className="w-6 h-6 text-amber-400" />
                    </div>
                    <h1 className="text-xl font-semibold">Cohort Invite Required</h1>
                    <p className="text-sm text-slate-400">
                        {authError || 'This learning portal is invite-only for CortDevs AI Product Manager cohort members.'}
                    </p>
                    <p className="text-xs text-slate-500">Signed in as {user.email}</p>
                    <button
                        onClick={signOut}
                        className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium transition"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    const navItemClass = ({ isActive }: { isActive: boolean }) =>
        `inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            isActive
                ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
        }`;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
            <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <Link to="/dashboard" className="flex items-center gap-2.5 group">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <GraduationCap className="w-5 h-5 text-white" />
                            </div>
                            <div className="leading-tight">
                                <div className="text-sm font-bold tracking-tight text-white">CortDevs Learn</div>
                                <div className="text-[11px] text-slate-400 truncate max-w-[190px] sm:max-w-[260px]">
                                    {cohort?.name || 'AI Product Manager Cohort'}
                                </div>
                            </div>
                        </Link>

                        <nav className="hidden md:flex items-center gap-1">
                            <NavLink to="/dashboard" className={navItemClass}>
                                <BookOpen className="w-4 h-4" />
                                Roadmap
                            </NavLink>
                            <NavLink to="/settings" className={navItemClass}>
                                <Settings className="w-4 h-4" />
                                Reminders
                            </NavLink>
                            {isAdmin && (
                                <NavLink to="/admin" className={navItemClass}>
                                    <ShieldCheck className="w-4 h-4" />
                                    Team Admin
                                </NavLink>
                            )}
                        </nav>
                    </div>

                    <div className="flex items-center gap-3">
                        <div
                            title="Active daily study streak"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-300 text-xs font-semibold"
                        >
                            <Flame className="w-3.5 h-3.5 text-orange-400" />
                            <span>{enrollment.current_streak || 0}d streak</span>
                        </div>

                        <div className="hidden sm:flex flex-col text-right leading-tight">
                            <span className="text-xs font-semibold text-slate-200">{enrollment.full_name}</span>
                            <span className="text-[11px] text-slate-400 capitalize">{enrollment.role}</span>
                        </div>

                        <button
                            onClick={signOut}
                            title="Sign out"
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Mobile quick nav */}
                <div className="md:hidden border-t border-slate-800/80 px-4 py-2 flex items-center gap-2 overflow-x-auto">
                    <NavLink to="/dashboard" className={navItemClass}>
                        <BookOpen className="w-4 h-4" /> Roadmap
                    </NavLink>
                    <NavLink to="/settings" className={navItemClass}>
                        <Settings className="w-4 h-4" /> Reminders
                    </NavLink>
                    {isAdmin && (
                        <NavLink to="/admin" className={navItemClass}>
                            <ShieldCheck className="w-4 h-4" /> Admin
                        </NavLink>
                    )}
                </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
                <Outlet />
            </main>
        </div>
    );
}
