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
                <h1 className="text-2xl font-light tracking-tight text-neutral-950 flex items-center gap-2.5">
                    <Bell className="w-5 h-5 text-neutral-900" />
                    Learning <span className="font-semibold">Reminders & Preferences</span>
                </h1>
                <p className="text-sm text-neutral-500 mt-1">
                    Daily reminders are automatically skipped on days when you have already completed at least one lesson.
                </p>
            </div>

            <form onSubmit={handleSave} className="bg-white border border-neutral-200 p-6 space-y-5">
                {savedMsg && (
                    <div className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 px-4 py-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        {savedMsg}
                    </div>
                )}
                {error && (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-2.5">
                        {error}
                    </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">Full Name</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">Role</label>
                        <input
                            type="text"
                            value={jobRole}
                            onChange={(e) => setJobRole(e.target.value)}
                            className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                        />
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">Timezone</label>
                        <input
                            type="text"
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">Preferred Reminder Hour</label>
                        <select
                            value={reminderHour}
                            onChange={(e) => setReminderHour(Number(e.target.value))}
                            className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
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
                        <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">Weekly Study Commitment (hrs)</label>
                        <input
                            type="number"
                            step="0.5"
                            min={2}
                            max={30}
                            value={weeklyHours}
                            onChange={(e) => setWeeklyHours(Number(e.target.value))}
                            className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">Snooze Reminders Until (optional)</label>
                        <input
                            type="date"
                            value={emailPausedUntil}
                            onChange={(e) => setEmailPausedUntil(e.target.value)}
                            className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                        />
                    </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer pt-1">
                    <input
                        type="checkbox"
                        checked={weekendReminders}
                        onChange={(e) => setWeekendReminders(e.target.checked)}
                        className="accent-neutral-950"
                    />
                    <span className="text-sm text-neutral-700">Send daily learning reminders on Saturday & Sunday too</span>
                </label>

                <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#030213] hover:bg-neutral-800 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-[0.18em] transition"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Preferences
                </button>
            </form>
        </div>
    );
}
