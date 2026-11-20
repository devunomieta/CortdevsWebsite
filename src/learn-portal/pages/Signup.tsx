import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, GraduationCap, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { learnApi } from '../lib/api';

export function LearnSignup() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const tokenParam = searchParams.get('token') || '';
    const emailParam = searchParams.get('email') || '';

    const [inviteInfo, setInviteInfo] = useState<any | null>(null);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [checkingInvite, setCheckingInvite] = useState(Boolean(tokenParam));

    const [email, setEmail] = useState(emailParam);
    const [fullName, setFullName] = useState('');
    const [jobRole, setJobRole] = useState('');
    const [password, setPassword] = useState('');
    const [reminderHour, setReminderHour] = useState(8);
    const [weeklyHours, setWeeklyHours] = useState(7.5);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!tokenParam) return;
        setCheckingInvite(true);
        learnApi(`lms/signup?token=${encodeURIComponent(tokenParam)}`, { auth: false })
            .then((res) => {
                setInviteInfo(res);
                if (res.email) setEmail(res.email);
                if (res.fullName) setFullName(res.fullName);
                setInviteError(null);
            })
            .catch((err) => {
                setInviteError(err?.message || 'Invite link is invalid or expired.');
            })
            .finally(() => setCheckingInvite(false));
    }, [tokenParam]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await learnApi('lms/signup', {
                method: 'POST',
                auth: false,
                body: {
                    email: email.trim().toLowerCase(),
                    password,
                    fullName: fullName.trim(),
                    jobRole: jobRole.trim() || 'Team Member',
                    inviteToken: tokenParam || undefined,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos',
                    reminderHour,
                    weeklyCommitmentHours: weeklyHours,
                },
            });

            // Auto sign-in immediately after account creation
            const { error: loginErr } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            });
            if (loginErr) throw loginErr;
            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            setError(err?.message || 'Signup failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
            <div className="w-full max-w-lg space-y-6">
                <div className="text-center space-y-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto">
                        <GraduationCap className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold">Join the AI Product Manager Cohort</h1>
                    <p className="text-sm text-slate-400">Create your gated learner profile & set your daily learning reminder.</p>
                </div>

                {checkingInvite ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        Verifying your invite link...
                    </div>
                ) : inviteError ? (
                    <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 text-center space-y-3">
                        <ShieldAlert className="w-8 h-8 text-red-400 mx-auto" />
                        <p className="text-sm text-red-200">{inviteError}</p>
                        <Link to="/login" className="inline-block text-xs text-indigo-400 hover:underline">
                            Back to Login
                        </Link>
                    </div>
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-2xl"
                    >
                        {inviteInfo?.cohort && (
                            <div className="flex items-start gap-2.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-3">
                                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-semibold">Invite Verified · {inviteInfo.cohort.name}</div>
                                    <div className="text-emerald-200/70">Cohort starts {inviteInfo.cohort.start_date}</div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3.5 py-2.5">
                                {error}
                            </div>
                        )}

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-300">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Adaeze Okafor"
                                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-300">Team Role</label>
                                <input
                                    type="text"
                                    value={jobRole}
                                    onChange={(e) => setJobRole(e.target.value)}
                                    placeholder="Product / Engineering / Design"
                                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-300">Invited Email Address</label>
                            <input
                                type="email"
                                required
                                readOnly={Boolean(inviteInfo?.email)}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@cortdevs.com"
                                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white disabled:opacity-60 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-300">Create Password (min 8 chars)</label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Choose a strong password"
                                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-300">Daily Reminder Time</label>
                                <select
                                    value={reminderHour}
                                    onChange={(e) => setReminderHour(Number(e.target.value))}
                                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                >
                                    {[6, 7, 8, 9, 12, 17, 19, 20].map((h) => (
                                        <option key={h} value={h}>
                                            {h === 12 ? '12:00 PM' : h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`} (Local)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-300">Weekly Study Goal</label>
                                <select
                                    value={weeklyHours}
                                    onChange={(e) => setWeeklyHours(Number(e.target.value))}
                                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                >
                                    <option value={6}>6 hrs/week (16-week light)</option>
                                    <option value={7.5}>7.5 hrs/week (12-week recommended)</option>
                                    <option value={11}>11 hrs/week (8-week intensive)</option>
                                </select>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Activate Cohort Access'}
                        </button>

                        <div className="text-center text-xs text-slate-400">
                            Already activated?{' '}
                            <Link to="/login" className="text-indigo-400 hover:underline">
                                Sign in
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
