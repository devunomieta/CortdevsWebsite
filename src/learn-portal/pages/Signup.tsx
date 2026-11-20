import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { learnApi } from '../lib/api';
import { CortDevsLearnLogo, CoursePartnerStrip } from '../components/BrandLogos';

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
        <div className="min-h-screen bg-neutral-50 text-neutral-950 flex flex-col justify-between p-6">
            <div className="max-w-7xl w-full mx-auto pt-2 flex items-center justify-between">
                <CortDevsLearnLogo size="md" />
                <Link
                    to="/login"
                    className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600 hover:text-neutral-950"
                >
                    Sign In
                </Link>
            </div>

            <div className="w-full max-w-lg mx-auto my-8 space-y-6">
                <div className="text-center space-y-3">
                    <div className="flex justify-center">
                        <CoursePartnerStrip compact />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-light tracking-tight">
                        Activate Your <span className="font-semibold">Cohort Seat</span>
                    </h1>
                    <p className="text-sm text-neutral-500">
                        Set up your gated learner profile & daily study reminder schedule.
                    </p>
                </div>

                {checkingInvite ? (
                    <div className="bg-white border border-neutral-200 p-8 text-center text-neutral-500 text-sm flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                        Verifying your invite link...
                    </div>
                ) : inviteError ? (
                    <div className="bg-white border border-red-200 p-8 text-center space-y-3">
                        <ShieldAlert className="w-8 h-8 text-red-600 mx-auto" />
                        <p className="text-sm text-red-700">{inviteError}</p>
                        <Link to="/login" className="inline-block text-xs font-semibold text-neutral-950 underline">
                            Back to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 p-6 sm:p-8 space-y-4 shadow-sm">
                        {inviteInfo?.cohort && (
                            <div className="flex items-start gap-2.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3">
                                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                                <div>
                                    <div className="font-semibold">Invite Verified · {inviteInfo.cohort.name}</div>
                                    <div className="text-emerald-700/80">Cohort starts {inviteInfo.cohort.start_date}</div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3.5 py-2.5">
                                {error}
                            </div>
                        )}

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Adaeze Okafor"
                                    className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">
                                    Team Role
                                </label>
                                <input
                                    type="text"
                                    value={jobRole}
                                    onChange={(e) => setJobRole(e.target.value)}
                                    placeholder="Product / Engineering / Design"
                                    className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">
                                Invited Email Address
                            </label>
                            <input
                                type="email"
                                required
                                readOnly={Boolean(inviteInfo?.email)}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@cortdevs.com"
                                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-950 read-only:bg-neutral-100 focus:outline-none focus:border-neutral-950"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">
                                Create Password (min 8 chars)
                            </label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Choose a strong password"
                                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                            />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-neutral-200">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">
                                    Daily Reminder Time
                                </label>
                                <select
                                    value={reminderHour}
                                    onChange={(e) => setReminderHour(Number(e.target.value))}
                                    className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                                >
                                    {[6, 7, 8, 9, 12, 17, 19, 20].map((h) => (
                                        <option key={h} value={h}>
                                            {h === 12 ? '12:00 PM' : h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`} (Local)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">
                                    Weekly Study Goal
                                </label>
                                <select
                                    value={weeklyHours}
                                    onChange={(e) => setWeeklyHours(Number(e.target.value))}
                                    className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
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
                            className="w-full py-3.5 px-4 bg-[#030213] hover:bg-neutral-800 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Activate Cohort Access'}
                        </button>

                        <div className="text-center text-xs text-neutral-500 pt-1">
                            Already activated?{' '}
                            <Link to="/login" className="text-neutral-950 font-semibold underline underline-offset-4">
                                Sign in
                            </Link>
                        </div>
                    </form>
                )}
            </div>

            <div className="text-center text-[11px] text-neutral-400 pb-2">
                CortDevs · Precision Engineering & Product Excellence
            </div>
        </div>
    );
}
