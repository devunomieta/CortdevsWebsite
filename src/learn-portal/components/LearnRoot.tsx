import React, { lazy, Suspense } from 'react';
import { Outlet } from 'react-router';
import { Loader2 } from 'lucide-react';
import { LearnAuthProvider } from '../context/LearnAuthContext';

const LazyAdminDashboard = lazy(() =>
    import('../admin/AdminDashboard').then((m) => ({ default: m.LearnAdminDashboard })),
);

export function LearnRoot() {
    return (
        <LearnAuthProvider>
            <Outlet />
        </LearnAuthProvider>
    );
}

export function LazyAdminRoute() {
    return (
        <Suspense
            fallback={
                <div className="py-20 flex items-center justify-center gap-3 text-neutral-500">
                    <Loader2 className="w-5 h-5 animate-spin text-neutral-950" />
                    <span className="text-xs uppercase tracking-[0.2em]">Loading team dashboard...</span>
                </div>
            }
        >
            <LazyAdminDashboard />
        </Suspense>
    );
}
