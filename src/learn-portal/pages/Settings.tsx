import React, { useState } from 'react';
import { Bell, CheckCircle2, Loader2, Save } from 'lucide-react';
import { useLearnAuth } from '../context/LearnAuthContext';
import { learnApi } from '../lib/api';

export function LearnSettings() {
    const { enrollment, refreshProfile } = useLearnAuth();
    const [fullName, setFullName] = useState(enrollment?.full_name || '');
    const [jobRole, setJobRole] = useState(enrollment?.job_role || '');
    const [timezone, setTimezone] = useState(enrollment?.timezone || 'Africa/Lagos');
    const [reminderHour, setReminderHour] = useState(enrollment?.reminder_hour ?? 8);
    const [weekendReminders, setWeekendReminders] = useState(Boolean(enrollment?.weekend_reminders));
    const [emailPausedUntil, setEmailPausedUntil] = useState(enrollment?.email_paused_until || '');
    const [weeklyHours, setWeeklyHours] = useState(enrollment?.weekly_commitment_hours ?? 7.5);
    const [saving, setSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSavedMsg(null);
        setError(null);
        try {
            await learnApi('lms/profile', {
                method: 'PATCH',
                body: {
                    full_name: fullName,
                    job_role: jobRole,
                    timezone,
                    reminder_hour: reminderHour,
                    weekend_reminders: weekendReminders,
                    email_paused_until: emailPausedUntil || null,
                    weekly_commitment_hours: weeklyHours,
                },
            });
            await refreshProfile();
            setSavedMsg('Learning reminder preferences saved!');
        } catch (err: any) {
            setError(err?.message || 'Failed to save preferences');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
                    <Bell className="w-6 h-6 text-indigo-400" />
                    Learning Reminders & Preferences
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                    Daily reminders are automatically skipped on days when you have already completed at least one lesson.
                </p>
            </div>

            <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                {savedMsg && (
                    <div className="flex items-center gap-2 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-4 py-2.5">
                        <CheckCircle2 className="w-4 h-4" />
                        {savedMsg}
                    </div>
                )}
                {error && (
                    <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5">
                        {error}
                    </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">Full Name</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">Role</label>
                        <input
                            type="text"
                            value={jobRole}
                            onChange={(e) => setJobRole(e.target.value)}
                            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white"
                        />
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">Timezone</label>
                        <input
                            type="text"
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">Preferred Reminder Hour</label>
                        <select
                            value={reminderHour}
                            onChange={(e) => setReminderHour(Number(e.target.value))}
                            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white"
                        >
                            {Array.from({ length: 18 }, (_, i) => i + 5).map((h) => (
                                <option key={h} value={h}>
                                    {h === 12 ? '12:00 PM' : h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">Weekly Study Commitment (hrs)</label>
                        <input
                            type="number"
                            step="0.5"
                            min={2}
                            max={30}
                            value={weeklyHours}
                            onChange={(e) => setWeeklyHours(Number(e.target.value))}
                            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-300">Snooze Reminders Until (optional)</label>
                        <input
                            type="date"
                            value={emailPausedUntil}
                            onChange={(e) => setEmailPausedUntil(e.target.value)}
                            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white"
                        />
                    </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer pt-1">
                    <input
                        type="checkbox"
                        checked={weekendReminders}
                        onChange={(e) => setWeekendReminders(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-300">Send daily learning reminders on Saturday & Sunday too</span>
                </label>

                <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Preferences
                </button>
            </form>
        </div>
    );
}
