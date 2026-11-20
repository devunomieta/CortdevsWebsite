import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import {
    AlertTriangle,
    BellRing,
    Calendar,
    CheckCircle2,
    Download,
    ExternalLink,
    FileDown,
    FileQuestion,
    FolderCheck,
    Loader2,
    Save,
    ShieldCheck,
    Trash2,
    Unlock,
    UserPlus,
    Users,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLearnAuth } from '../context/LearnAuthContext';
import { learnApi } from '../lib/api';

type AdminTab = 'matrix' | 'reviews' | 'team' | 'quizzes';

export function LearnAdminDashboard() {
    const { isAdmin } = useLearnAuth();
    const [tab, setTab] = useState<AdminTab>('matrix');

    const [overview, setOverview] = useState<any | null>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [invites, setInvites] = useState<any[]>([]);
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [selectedQuiz, setSelectedQuiz] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<string | null>(null);

    // Invite form
    const [invEmail, setInvEmail] = useState('');
    const [invName, setInvName] = useState('');
    const [invRole, setInvRole] = useState<'learner' | 'admin'>('learner');
    const [inviting, setInviting] = useState(false);

    // Cohort settings form
    const [cohortStart, setCohortStart] = useState('');
    const [cohortPacing, setCohortPacing] = useState('weekly_drip_sequential');
    const [savingCohort, setSavingCohort] = useState(false);

    // Nudge modal state
    const [nudgeTarget, setNudgeTarget] = useState<any | null>(null);
    const [nudgeMsg, setNudgeMsg] = useState('');
    const [sendingNudge, setSendingNudge] = useState(false);

    // Review feedback draft per submission
    const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});

    const showToast = (msg: string) => {
        setToast(msg);
        window.setTimeout(() => setToast(null), 4000);
    };

    const loadAll = async () => {
        setLoading(true);
        try {
            const [ov, rev, inv, qz] = await Promise.all([
                learnApi('admin/lms/overview'),
                learnApi('admin/lms/reviews'),
                learnApi('admin/lms/invites'),
                learnApi('admin/lms/quiz-keys'),
            ]);
            setOverview(ov);
            setCohortStart(ov.cohort?.start_date || '');
            setCohortPacing(ov.cohort?.pacing_mode || 'weekly_drip_sequential');
            setReviews(rev.submissions || []);
            setInvites(inv.invites || []);
            setQuizzes(qz.quizzes || []);
        } catch (err: any) {
            showToast(err?.message || 'Failed to load admin data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) loadAll();
    }, [isAdmin]);

    if (!isAdmin) return <Navigate to="/dashboard" replace />;

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        try {
            await learnApi('admin/lms/invites', {
                method: 'POST',
                body: { email: invEmail, fullName: invName, role: invRole },
            });
            setInvEmail('');
            setInvName('');
            showToast('Invite sent via email!');
            const inv = await learnApi('admin/lms/invites');
            setInvites(inv.invites || []);
        } catch (err: any) {
            showToast(err?.message || 'Invite failed');
        } finally {
            setInviting(false);
        }
    };

    const handleDeleteInvite = async (id: string) => {
        await learnApi(`admin/lms/invites?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        setInvites((prev) => prev.filter((i) => i.id !== id));
    };

    const handleSaveCohort = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingCohort(true);
        try {
            await learnApi('admin/lms/cohorts', {
                method: 'PATCH',
                body: { start_date: cohortStart, pacing_mode: cohortPacing },
            });
            showToast('Cohort schedule & Monday drip start date updated!');
            loadAll();
        } catch (err: any) {
            showToast(err?.message || 'Update failed');
        } finally {
            setSavingCohort(false);
        }
    };

    const handleAssignBuddy = async (enrollmentId: string, peerBuddyUserId: string) => {
        await learnApi('admin/lms/cohorts', {
            method: 'PATCH',
            body: { action: 'assign_buddy', enrollmentId, peerBuddyUserId: peerBuddyUserId || null },
        });
        showToast('Peer accountability buddy updated!');
        loadAll();
    };

    const handleReview = async (submissionId: string, status: 'approved' | 'revision_requested') => {
        try {
            await learnApi('admin/lms/reviews', {
                method: 'PATCH',
                body: { submissionId, reviewStatus: status, feedback: feedbackMap[submissionId] || '' },
            });
            showToast(`Submission marked as ${status.replace('_', ' ')} and learner notified!`);
            loadAll();
        } catch (err: any) {
            showToast(err?.message || 'Review failed');
        }
    };

    const handleSendNudge = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nudgeTarget) return;
        setSendingNudge(true);
        try {
            await learnApi('admin/lms/nudge', {
                method: 'POST',
                body: { action: 'nudge', targetUserId: nudgeTarget.userId, message: nudgeMsg },
            });
            showToast(`Personal nudge emailed to ${nudgeTarget.fullName}!`);
            setNudgeTarget(null);
            setNudgeMsg('');
        } catch (err: any) {
            showToast(err?.message || 'Nudge failed');
        } finally {
            setSendingNudge(false);
        }
    };

    const handleGrantDripOverride = async (targetUserId: string, fullName: string) => {
        await learnApi('admin/lms/nudge', {
            method: 'POST',
            body: {
                action: 'override',
                targetUserId,
                overrideType: 'unlock_drip',
                reason: 'Admin granted early weekly drip access',
            },
        });
        showToast(`Early weekly drip override granted to ${fullName}.`);
    };

    const handleOpenQuizEditor = async (lessonId: string) => {
        const res = await learnApi(`admin/lms/quiz-keys?lessonId=${encodeURIComponent(lessonId)}`);
        setSelectedQuiz(res.quiz);
    };

    const toggleQuizKey = (qIdx: number, optIdx: number) => {
        if (!selectedQuiz) return;
        const copy = JSON.parse(JSON.stringify(selectedQuiz));
        const q = copy.quiz_questions_json[qIdx];
        const cur: number[] = Array.isArray(q.correct_indices) ? q.correct_indices : [];
        if (q.type === 'single') {
            q.correct_indices = [optIdx];
        } else {
            q.correct_indices = cur.includes(optIdx) ? cur.filter((x) => x !== optIdx) : [...cur, optIdx].sort();
        }
        setSelectedQuiz(copy);
    };

    const handleSaveQuizKeys = async () => {
        if (!selectedQuiz) return;
        await learnApi('admin/lms/quiz-keys', {
            method: 'PATCH',
            body: {
                lessonId: selectedQuiz.id,
                questions: selectedQuiz.quiz_questions_json,
                verified: true,
                passThresholdPct: selectedQuiz.pass_threshold_pct || 80,
            },
        });
        showToast('Quiz answer key verified & locked!');
        setSelectedQuiz(null);
        loadAll();
    };

    const handleExportPdf = () => {
        if (!overview) return;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text(`CortDevs Learn — Weekly Accountability Report`, 14, 18);
        doc.setFontSize(10);
        doc.text(
            `${overview.cohort.name} | Generated: ${new Date().toLocaleDateString()} | Target Pace: ${overview.summary.targetPct}%`,
            14,
            25,
        );
        autoTable(doc, {
            startY: 32,
            head: [['Team Member', 'Email', 'Progress', 'Video (min)', 'Reading (min)', 'Avg Quiz', 'Streak', 'Inactive', 'Status']],
            body: overview.learners.map((l: any) => [
                l.fullName,
                l.email,
                `${l.progressPct}% (${l.completedLessons}/${l.totalLessons})`,
                `${l.watchedMinutes}m`,
                `${l.readingMinutes}m`,
                l.avgQuizScore !== null ? `${l.avgQuizScore}%` : '—',
                `${l.streak}d`,
                `${l.daysInactive}d`,
                l.riskStatus.replace('_', ' ').toUpperCase(),
            ]),
        });
        doc.save(`cortdevs-ai-pm-accountability-${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    if (loading) {
        return (
            <div className="py-20 flex items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                <span className="text-sm">Loading team accountability console...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-indigo-400" />
                        Cohort Accountability Console
                    </h1>
                    <p className="text-sm text-slate-400">{overview?.cohort?.name}</p>
                </div>

                <button
                    onClick={handleExportPdf}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
                >
                    <FileDown className="w-4 h-4 text-indigo-400" />
                    Export PDF Report
                </button>
            </div>

            {toast && (
                <div className="rounded-xl bg-indigo-500/15 border border-indigo-500/30 px-4 py-3 text-sm text-indigo-200">
                    {toast}
                </div>
            )}

            {/* KPI Strip */}
            {overview?.summary && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                        <div className="text-xs text-slate-400">Team Enrolled</div>
                        <div className="text-2xl font-bold text-white mt-1">{overview.summary.totalLearners}</div>
                    </div>
                    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                        <div className="text-xs text-slate-400">Avg Progress vs Target</div>
                        <div className="text-2xl font-bold text-indigo-300 mt-1">
                            {overview.summary.avgProgressPct}%{' '}
                            <span className="text-xs text-slate-500 font-normal">/ {overview.summary.targetPct}%</span>
                        </div>
                    </div>
                    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                        <div className="text-xs text-slate-400">At-Risk Members</div>
                        <div className="text-2xl font-bold text-amber-400 mt-1">{overview.summary.atRiskCount}</div>
                    </div>
                    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                        <div className="text-xs text-slate-400">Pending Reviews</div>
                        <div className="text-2xl font-bold text-sky-400 mt-1">{overview.summary.pendingReviewsCount}</div>
                    </div>
                    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                        <div className="text-xs text-slate-400">Verified Quiz Keys</div>
                        <div className="text-2xl font-bold text-emerald-400 mt-1">
                            {overview.summary.totalQuizzesCount - overview.summary.unverifiedQuizzesCount}{' '}
                            <span className="text-xs text-slate-500 font-normal">/ {overview.summary.totalQuizzesCount}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Bar */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
                {[
                    { id: 'matrix', label: 'Cohort Matrix', icon: Users },
                    { id: 'reviews', label: `Project Reviews (${overview?.summary?.pendingReviewsCount || 0})`, icon: FolderCheck },
                    { id: 'team', label: 'Invites & Drip Schedule', icon: Calendar },
                    { id: 'quizzes', label: `Quiz Answer Keys (${overview?.summary?.unverifiedQuizzesCount || 0} pending)`, icon: FileQuestion },
                ].map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id as AdminTab)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                                tab === t.id
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: COHORT ACCOUNTABILITY MATRIX */}
            {tab === 'matrix' && overview && (
                <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                            <tr>
                                <th className="p-3.5 sticky left-0 bg-slate-950 z-10 min-w-[200px]">Team Member</th>
                                <th className="p-3.5">Progress</th>
                                <th className="p-3.5">Watch / Read</th>
                                <th className="p-3.5">Streak / Idle</th>
                                <th className="p-3.5">Status</th>
                                <th className="p-3.5 min-w-[260px]">28-Module Heatmap</th>
                                <th className="p-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                            {overview.learners.map((l: any) => (
                                <tr key={l.userId} className="hover:bg-slate-800/30">
                                    <td className="p-3.5 sticky left-0 bg-slate-900">
                                        <div className="font-semibold text-white">{l.fullName}</div>
                                        <div className="text-[11px] text-slate-400">{l.email}</div>
                                    </td>
                                    <td className="p-3.5">
                                        <div className="font-bold text-indigo-300">{l.progressPct}%</div>
                                        <div className="text-[11px] text-slate-500">
                                            {l.completedLessons}/{l.totalLessons}
                                        </div>
                                    </td>
                                    <td className="p-3.5 text-slate-300">
                                        {l.watchedMinutes}m vid · {l.readingMinutes}m read
                                    </td>
                                    <td className="p-3.5">
                                        <span className="text-orange-300 font-semibold">{l.streak}d</span>
                                        <span className="text-slate-500"> · {l.daysInactive}d idle</span>
                                    </td>
                                    <td className="p-3.5">
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                l.riskStatus === 'on_track'
                                                    ? 'bg-emerald-500/15 text-emerald-300'
                                                    : l.riskStatus === 'behind'
                                                      ? 'bg-amber-500/15 text-amber-300'
                                                      : 'bg-red-500/15 text-red-300'
                                            }`}
                                        >
                                            {l.riskStatus.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="p-3.5">
                                        <div className="flex flex-wrap gap-1">
                                            {l.moduleMatrix.map((cell: any) => (
                                                <div
                                                    key={cell.moduleId}
                                                    title={`M${cell.globalOrder} (W${cell.targetWeek}): ${cell.done}/${cell.total} (${cell.status})`}
                                                    className={`w-3.5 h-3.5 rounded-sm ${
                                                        cell.status === 'completed'
                                                            ? 'bg-emerald-500'
                                                            : cell.status === 'in_progress'
                                                              ? 'bg-indigo-500'
                                                              : cell.status === 'drip_locked'
                                                                ? 'bg-slate-800/60 border border-slate-700/50'
                                                                : 'bg-amber-500/30 border border-amber-500/40'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                                        <button
                                            onClick={() => {
                                                setNudgeTarget(l);
                                                setNudgeMsg(`Hey ${l.fullName.split(' ')[0]}, checking in on your AI PM cohort progress this week — let me know if anything is blocking you!`);
                                            }}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 font-medium"
                                        >
                                            <BellRing className="w-3.5 h-3.5" /> Nudge
                                        </button>
                                        <button
                                            onClick={() => handleGrantDripOverride(l.userId, l.fullName)}
                                            title="Bypass Monday drip lock for this member"
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                                        >
                                            <Unlock className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB 2: ASYNC PROJECT REVIEWS */}
            {tab === 'reviews' && (
                <div className="space-y-4">
                    {reviews.length === 0 ? (
                        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center text-sm text-slate-400">
                            No project deliverables submitted yet.
                        </div>
                    ) : (
                        reviews.map((sub) => (
                            <div key={sub.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <div className="text-sm font-semibold text-white">
                                            {sub.learner_name} · <span className="text-indigo-300">{sub.lesson_title}</span>
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {sub.module_title} · Submitted {new Date(sub.submitted_at).toLocaleString()}
                                        </div>
                                    </div>
                                    <span
                                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                                            sub.review_status === 'approved'
                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                : sub.review_status === 'revision_requested'
                                                  ? 'bg-amber-500/20 text-amber-300'
                                                  : 'bg-sky-500/20 text-sky-300'
                                        }`}
                                    >
                                        {sub.review_status.replace('_', ' ')}
                                    </span>
                                </div>

                                <p className="text-xs text-slate-300 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                                    {sub.reflection_notes}
                                </p>

                                <div className="flex flex-wrap gap-3 text-xs">
                                    {sub.download_url && (
                                        <a
                                            href={sub.download_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                                        >
                                            <Download className="w-3.5 h-3.5 text-indigo-400" />
                                            Download {sub.file_name || 'File'}
                                        </a>
                                    )}
                                    {sub.external_url && (
                                        <a
                                            href={sub.external_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300"
                                        >
                                            Open External Link <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-800">
                                    <input
                                        type="text"
                                        value={feedbackMap[sub.id] ?? sub.reviewer_feedback ?? ''}
                                        onChange={(e) => setFeedbackMap((p) => ({ ...p, [sub.id]: e.target.value }))}
                                        placeholder="Enter constructive review feedback..."
                                        className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                                    />
                                    <button
                                        onClick={() => handleReview(sub.id, 'approved')}
                                        className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                    </button>
                                    <button
                                        onClick={() => handleReview(sub.id, 'revision_requested')}
                                        className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                                    >
                                        <AlertTriangle className="w-3.5 h-3.5" /> Request Revision
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* TAB 3: INVITES, PEER BUDDIES & MONDAY DRIP SCHEDULE */}
            {tab === 'team' && (
                <div className="grid lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        {/* Cohort Schedule */}
                        <form onSubmit={handleSaveCohort} className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
                            <h3 className="text-sm font-semibold text-white">Cohort Start Date & Weekly Monday Drip</h3>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Week 1 Start Date (Pick a Monday)</label>
                                    <input
                                        type="date"
                                        value={cohortStart}
                                        onChange={(e) => setCohortStart(e.target.value)}
                                        className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Pacing Mode</label>
                                    <select
                                        value={cohortPacing}
                                        onChange={(e) => setCohortPacing(e.target.value)}
                                        className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                                    >
                                        <option value="weekly_drip_sequential">Sequential + Weekly Monday Drip</option>
                                        <option value="self_paced_sequential">Pure Sequential Self-Paced</option>
                                    </select>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={savingCohort}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                            >
                                <Save className="w-3.5 h-3.5" /> Save Schedule
                            </button>
                        </form>

                        {/* Invite Form */}
                        <form onSubmit={handleInvite} className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-indigo-400" /> Invite Team Member
                            </h3>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    value={invName}
                                    onChange={(e) => setInvName(e.target.value)}
                                    placeholder="Full Name"
                                    className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                                />
                                <input
                                    type="email"
                                    required
                                    value={invEmail}
                                    onChange={(e) => setInvEmail(e.target.value)}
                                    placeholder="teammate@cortdevs.com"
                                    className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <select
                                    value={invRole}
                                    onChange={(e) => setInvRole(e.target.value as any)}
                                    className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                                >
                                    <option value="learner">Learner</option>
                                    <option value="admin">Cohort Admin</option>
                                </select>
                                <button
                                    type="submit"
                                    disabled={inviting}
                                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                                >
                                    {inviting ? 'Sending...' : 'Send Invite Email'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Invites List & Peer Buddies */}
                    <div className="space-y-6">
                        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
                            <h3 className="text-sm font-semibold text-white">Sent Invites ({invites.length})</h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {invites.map((inv) => (
                                    <div
                                        key={inv.id}
                                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-slate-200 font-medium truncate">{inv.email}</div>
                                            <div className="text-[11px] text-slate-500">
                                                {inv.accepted_at ? 'Accepted ✓' : 'Pending signup'} · {inv.role}
                                            </div>
                                        </div>
                                        {!inv.accepted_at && (
                                            <button
                                                onClick={() => handleDeleteInvite(inv.id)}
                                                className="p-1.5 text-slate-500 hover:text-red-400"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {overview?.learners?.length > 1 && (
                            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
                                <h3 className="text-sm font-semibold text-white">Assign Peer Accountability Buddies</h3>
                                <div className="space-y-2">
                                    {overview.learners.map((l: any) => (
                                        <div key={l.enrollmentId} className="flex items-center justify-between gap-3 text-xs">
                                            <span className="text-slate-200 font-medium">{l.fullName}</span>
                                            <select
                                                value={l.peerBuddyUserId || ''}
                                                onChange={(e) => handleAssignBuddy(l.enrollmentId, e.target.value)}
                                                className="rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200"
                                            >
                                                <option value="">No buddy assigned</option>
                                                {overview.learners
                                                    .filter((other: any) => other.userId !== l.userId)
                                                    .map((other: any) => (
                                                        <option key={other.userId} value={other.userId}>
                                                            Buddy: {other.fullName}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 4: QUIZ ANSWER KEY VERIFICATION */}
            {tab === 'quizzes' && (
                <div className="grid lg:grid-cols-3 gap-6 items-start">
                    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-2 max-h-[600px] overflow-y-auto">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2 pb-1">
                            All Practice Quizzes ({quizzes.length})
                        </h3>
                        {quizzes.map((q: any) => (
                            <button
                                key={q.id}
                                onClick={() => handleOpenQuizEditor(q.id)}
                                className={`w-full text-left p-3 rounded-xl border text-xs transition ${
                                    selectedQuiz?.id === q.id
                                        ? 'bg-indigo-500/15 border-indigo-500/50 text-white'
                                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium truncate">{q.title}</span>
                                    <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                            q.quiz_keys_verified ? 'bg-emerald-400' : 'bg-amber-400'
                                        }`}
                                    />
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    W{q.lms_modules?.target_week} · {q.lms_modules?.title}
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-6">
                        {!selectedQuiz ? (
                            <p className="text-sm text-slate-400 py-12 text-center">
                                Select a quiz on the left to review parsed questions and lock the official answer key.
                            </p>
                        ) : (
                            <div className="space-y-5">
                                <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
                                    <div>
                                        <h3 className="text-base font-bold text-white">{selectedQuiz.title}</h3>
                                        <p className="text-xs text-slate-400">
                                            Click the correct option(s) for each question, then Save & Lock.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleSaveQuizKeys}
                                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                                    >
                                        <Save className="w-3.5 h-3.5" /> Save & Lock Key
                                    </button>
                                </div>

                                <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
                                    {(selectedQuiz.quiz_questions_json || []).map((q: any, qIdx: number) => (
                                        <div key={q.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                                            <p className="text-xs font-semibold text-white">
                                                Q{qIdx + 1}. {q.prompt}
                                            </p>
                                            <div className="space-y-1.5">
                                                {q.options.map((opt: string, optIdx: number) => {
                                                    const isCorrect = (q.correct_indices || []).includes(optIdx);
                                                    return (
                                                        <button
                                                            key={optIdx}
                                                            type="button"
                                                            onClick={() => toggleQuizKey(qIdx, optIdx)}
                                                            className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition ${
                                                                isCorrect
                                                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 font-semibold'
                                                                    : 'bg-slate-900 border-slate-800 text-slate-300'
                                                            }`}
                                                        >
                                                            {isCorrect ? '✓ ' : '○ '}
                                                            {opt}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Personal Nudge Modal */}
            {nudgeTarget && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <form
                        onSubmit={handleSendNudge}
                        className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl"
                    >
                        <h3 className="text-base font-bold text-white">Send Personal Nudge to {nudgeTarget.fullName}</h3>
                        <textarea
                            rows={4}
                            required
                            value={nudgeMsg}
                            onChange={(e) => setNudgeMsg(e.target.value)}
                            className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setNudgeTarget(null)}
                                className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={sendingNudge}
                                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
                            >
                                {sendingNudge ? 'Sending...' : 'Send Email Nudge'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
