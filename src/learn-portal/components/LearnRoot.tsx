import React, { lazy, Suspense, useEffect } from 'react';
import { Outlet } from 'react-router';
import { Loader2 } from 'lucide-react';
import { LearnAuthProvider } from '../context/LearnAuthContext';

const LazyAdminDashboard = lazy(() =>
    import('../admin/AdminDashboard').then((m) => ({ default: m.LearnAdminDashboard })),
);

export function LearnRoot() {
    // Strictly lock Learn portal into Light Mode even on dark-mode OS/browser devices
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('dark');
        root.classList.add('light', 'learn-force-light');
        root.style.colorScheme = 'light';

        let meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'color-scheme';
            document.head.appendChild(meta);
        }
        meta.content = 'only light';

        return () => {
            root.classList.remove('learn-force-light');
        };
    }, []);

    return (
        <div className="learn-portal-root min-h-screen bg-white text-neutral-950">
            <LearnAuthProvider>
                <Outlet />
            </LearnAuthProvider>
        </div>
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
