import React, { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CortDevsLearnLogo, CoursePartnerStrip } from '../components/BrandLogos';
import { useLearnAuth } from '../context/LearnAuthContext';
import { resetLearnSessionTimer } from '../lib/sessionTimer';

export function LearnLogin() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const rawNext = searchParams.get('next') || '/dashboard';
    // Only allow internal relative paths (never redirect back to /login or external URLs)
    const safeNextUrl =
        rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.startsWith('/login')
            ? rawNext
            : '/dashboard';

    const { loading: authLoading, user, enrollment } = useLearnAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-white text-neutral-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <CortDevsLearnLogo size="md" />
                    <div className="flex items-center gap-2 text-neutral-500 text-xs uppercase tracking-[0.2em]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-950" />
                        <span>Checking Session</span>
                    </div>
                </div>
            </div>
        );
    }

    // Auto-redirect already logged-in users straight to their dashboard
    if (user && enrollment) {
        return <Navigate to={safeNextUrl} replace />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const { error: signInErr } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            });
            if (signInErr) throw signInErr;
            // Reset the 3-day persistent login timer on every fresh sign-in
            resetLearnSessionTimer();
            navigate(safeNextUrl, { replace: true });
        } catch (err: any) {
            setError(err?.message || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-950 flex flex-col justify-between p-6">
            <div className="max-w-7xl w-full mx-auto pt-2 flex items-center justify-between">
                <CortDevsLearnLogo size="md" />
                <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">
                    Private Team Cohort
                </span>
            </div>

            <div className="w-full max-w-md mx-auto my-10 space-y-6">
                <div className="text-center space-y-3">
                    <div className="flex justify-center">
                        <CoursePartnerStrip compact />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-950">
                        AI Product Manager <span className="font-semibold">Cohort</span>
                    </h1>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="bg-white border border-neutral-200 p-6 sm:p-8 space-y-5 shadow-sm"
                >
                    {error && (
                        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3.5 py-2.5">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">
                            Email Address
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full bg-white border border-neutral-300 px-3.5 py-3 text-base sm:text-sm text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 transition"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-white border border-neutral-300 px-3.5 py-3 pr-11 text-base sm:text-sm text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 transition"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-950 p-1 transition"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-4 bg-[#030213] hover:bg-neutral-800 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                Sign In <ArrowRight className="w-3.5 h-3.5" />
                            </>
                        )}
                    </button>
                </form>
            </div>

            <div className="text-center text-[11px] text-neutral-400 pb-2">
                CortDevs · Precision Engineering & Product Excellence
            </div>
        </div>
    );
}
