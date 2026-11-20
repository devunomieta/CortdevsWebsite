import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { GraduationCap, Lock, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function LearnLogin() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const nextUrl = searchParams.get('next') || '/dashboard';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            navigate(nextUrl, { replace: true });
        } catch (err: any) {
            setError(err?.message || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/25">
                        <GraduationCap className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">CortDevs Learn</h1>
                    <p className="text-sm text-slate-400">Microsoft AI Product Manager · Private Team Cohort</p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-2xl"
                >
                    <div className="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>Gated team portal — invite-only sequential cohort access.</span>
                    </div>

                    {error && (
                        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-2.5">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">Work Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@cortdevs.com"
                            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                    </button>

                    <div className="text-center pt-2 text-xs text-slate-400">
                        Have an invite from your team lead?{' '}
                        <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium">
                            Activate your account
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
