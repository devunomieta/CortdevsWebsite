import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import {
    AlertTriangle,
    Ban,
    BellRing,
    Calendar,
    Check,
    CheckCircle2,
    Copy,
    Download,
    ExternalLink,
    Eye,
    EyeOff,
    FileDown,
    FileQuestion,
    FolderCheck,
    KeyRound,
    Loader2,
    Mail,
    PauseCircle,
    PlayCircle,
    RefreshCw,
    Save,
    ShieldCheck,
    Unlock,
    UserPlus,
    Users,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLearnAuth } from '../context/LearnAuthContext';
import { learnApi } from '../lib/api';

type AdminTab = 'matrix' | 'reviews' | 'team' | 'quizzes';

function generateStrongPassword(length = 12): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let out = '';
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    for (let i = 0; i < length; i++) {
        out += chars[arr[i] % chars.length];
    }
    return out;
}

export function LearnAdminDashboard() {
    const { isAdmin, user } = useLearnAuth();
    const [tab, setTab] = useState<AdminTab>('matrix');

    const [overview, setOverview] = useState<any | null>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [selectedQuiz, setSelectedQuiz] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<string | null>(null);

    // Direct Account Creation Form (Replaces Invite Flow)
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newJobRole, setNewJobRole] = useState('Team Member');
    const [newRole, setNewRole] = useState<'learner' | 'admin'>('learner');
    const [newPassword, setNewPassword] = useState(() => generateStrongPassword());
    const [showNewPwd, setShowNewPwd] = useState(true);
    const [sendCredsOnCreate, setSendCredsOnCreate] = useState(false);
    const [creatingAccount, setCreatingAccount] = useState(false);

    // Latest generated/updated credentials card (copy or email manually)
    const [credsBox, setCredsBox] = useState<{
        userId: string;
        fullName: string;
        email: string;
        password: string;
        loginUrl: string;
        isReset?: boolean;
        emailed?: boolean;
    } | null>(null);
    const [copiedCreds, setCopiedCreds] = useState(false);
    const [emailingCreds, setEmailingCreds] = useState(false);

    // Change Password Modal
    const [pwdTarget, setPwdTarget] = useState<any | null>(null);
    const [resetPwdValue, setResetPwdValue] = useState('');
    const [showResetPwd, setShowResetPwd] = useState(true);
    const [emailOnReset, setEmailOnReset] = useState(false);
    const [savingResetPwd, setSavingResetPwd] = useState(false);

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
        window.setTimeout(() => setToast(null), 4500);
    };

    const loadAll = async () => {
        setLoading(true);
        try {
            const [ov, rev, mem, qz] = await Promise.all([
                learnApi('admin/lms/overview'),
                learnApi('admin/lms/reviews'),
                learnApi('admin/lms/members'),
                learnApi('admin/lms/quiz-keys'),
            ]);
            setOverview(ov);
            setCohortStart(ov.cohort?.start_date || '');
            setCohortPacing(ov.cohort?.pacing_mode || 'weekly_drip_sequential');
            setReviews(rev.submissions || []);
            setMembers(mem.members || []);
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

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingAccount(true);
        try {
            const res = await learnApi('admin/lms/members', {
                method: 'POST',
                body: {
                    fullName: newName.trim(),
                    email: newEmail.trim().toLowerCase(),
                    jobRole: newJobRole.trim() || 'Team Member',
                    role: newRole,
                    password: newPassword,
                    sendEmail: sendCredsOnCreate,
                },
            });
            setCredsBox({
                userId: res.member.user_id,
                fullName: res.credentials.fullName,
                email: res.credentials.email,
                password: res.credentials.password,
                loginUrl: res.credentials.loginUrl,
                isReset: false,
                emailed: res.emailed,
            });
            setNewName('');
            setNewEmail('');
            setNewPassword(generateStrongPassword());
            showToast(
                res.emailed
                    ? 'Account created and login credentials emailed!'
                    : 'Account created! Copy the login credentials below or send via email.',
            );
            loadAll();
        } catch (err: any) {
            showToast(err?.message || 'Failed to create account');
        } finally {
            setCreatingAccount(false);
        }
    };

    const handleCopyCreds = async () => {
        if (!credsBox) return;
        const text = `CortDevs Learn — Access Credentials\nPortal URL: ${credsBox.loginUrl}\nEmail Address: ${credsBox.email}\nPassword: ${credsBox.password}`;
        await navigator.clipboard.writeText(text);
        setCopiedCreds(true);
        showToast('Login credentials copied to clipboard!');
        window.setTimeout(() => setCopiedCreds(false), 2500);
    };

    const handleEmailCredsNow = async () => {
        if (!credsBox) return;
        setEmailingCreds(true);
        try {
            await learnApi('admin/lms/members', {
                method: 'PATCH',
                body: {
                    action: 'send_credentials',
                    targetUserId: credsBox.userId,
                    password: credsBox.password,
                    isPasswordReset: Boolean(credsBox.isReset),
                },
            });
            setCredsBox((prev) => (prev ? { ...prev, emailed: true } : null));
            showToast(`Login credentials emailed to ${credsBox.email}!`);
        } catch (err: any) {
            showToast(err?.message || 'Failed to email credentials');
        } finally {
            setEmailingCreds(false);
        }
    };

    const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pwdTarget) return;
        setSavingResetPwd(true);
        try {
            const res = await learnApi('admin/lms/members', {
                method: 'PATCH',
                body: {
                    action: 'reset_password',
                    targetUserId: pwdTarget.user_id,
                    password: resetPwdValue,
                    sendEmail: emailOnReset,
                },
            });
            setCredsBox({
                userId: pwdTarget.user_id,
                fullName: res.credentials.fullName,
                email: res.credentials.email,
                password: res.credentials.password,
                loginUrl: res.credentials.loginUrl,
                isReset: true,
                emailed: res.emailed,
            });
            setPwdTarget(null);
            setResetPwdValue('');
            showToast(
                res.emailed
                    ? `Password updated and emailed to ${pwdTarget.email}!`
                    : `Password updated for ${pwdTarget.full_name}. Copy or email the new credentials above.`,
            );
        } catch (err: any) {
            showToast(err?.message || 'Password reset failed');
        } finally {
            setSavingResetPwd(false);
        }
    };

    const handleSetMemberStatus = async (member: any, nextStatus: 'active' | 'paused' | 'removed') => {
        if (nextStatus === 'removed') {
            const ok = window.confirm(
                `Permanently block ${member.full_name} (${member.email})? This revokes their access and locks their auth account.`,
            );
            if (!ok) return;
        }
        try {
            await learnApi('admin/lms/members', {
                method: 'PATCH',
                body: {
                    action: 'set_status',
                    targetUserId: member.user_id,
                    status: nextStatus,
                },
            });
            const label =
                nextStatus === 'paused'
                    ? 'temporarily blocked'
                    : nextStatus === 'removed'
                      ? 'permanently blocked'
                      : 'restored to active';
            showToast(`${member.full_name} has been ${label}.`);
            loadAll();
        } catch (err: any) {
            showToast(err?.message || 'Failed to update access status');
        }
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
            <div className="py-20 flex items-center justify-center gap-3 text-neutral-500">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-950" />
                <span className="text-xs uppercase tracking-[0.2em]">Loading accountability console...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-light tracking-tight text-neutral-950 flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-neutral-900" />
                        Cohort <span className="font-semibold">Accountability Console</span>
                    </h1>
                    <p className="text-sm text-neutral-500">{overview?.cohort?.name}</p>
                </div>

                <button
                    onClick={handleExportPdf}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#030213] hover:bg-neutral-800 text-xs font-bold uppercase tracking-[0.16em] text-white transition"
                >
                    <FileDown className="w-4 h-4" />
                    Export PDF Report
                </button>
            </div>

            {toast && (
                <div className="bg-neutral-950 text-white px-4 py-3 text-sm border border-neutral-800">
                    {toast}
                </div>
            )}

            {/* KPI Strip */}
            {overview?.summary && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="bg-white border border-neutral-200 p-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">Active Members</div>
                        <div className="text-2xl font-semibold text-neutral-950 mt-1">{overview.summary.totalLearners}</div>
                    </div>
                    <div className="bg-white border border-neutral-200 p-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">Avg vs Target</div>
                        <div className="text-2xl font-semibold text-neutral-950 mt-1">
                            {overview.summary.avgProgressPct}%{' '}
                            <span className="text-xs text-neutral-400 font-normal">/ {overview.summary.targetPct}%</span>
                        </div>
                    </div>
                    <div className="bg-white border border-neutral-200 p-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">At-Risk Members</div>
                        <div className="text-2xl font-semibold text-amber-700 mt-1">{overview.summary.atRiskCount}</div>
                    </div>
                    <div className="bg-white border border-neutral-200 p-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">Pending Reviews</div>
                        <div className="text-2xl font-semibold text-neutral-950 mt-1">{overview.summary.pendingReviewsCount}</div>
                    </div>
                    <div className="bg-white border border-neutral-200 p-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">Verified Quiz Keys</div>
                        <div className="text-2xl font-semibold text-emerald-700 mt-1">
                            {overview.summary.totalQuizzesCount - overview.summary.unverifiedQuizzesCount}{' '}
                            <span className="text-xs text-neutral-400 font-normal">/ {overview.summary.totalQuizzesCount}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Bar */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 overflow-x-auto">
                {[
                    { id: 'matrix', label: 'Cohort Matrix', icon: Users },
                    { id: 'reviews', label: `Project Reviews (${overview?.summary?.pendingReviewsCount || 0})`, icon: FolderCheck },
                    { id: 'team', label: `Team Access (${members.length}) & Drip`, icon: Calendar },
                    { id: 'quizzes', label: `Quiz Answer Keys (${overview?.summary?.unverifiedQuizzesCount || 0} pending)`, icon: FileQuestion },
                ].map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id as AdminTab)}
                            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] whitespace-nowrap transition border ${
                                tab === t.id
                                    ? 'bg-[#030213] text-white border-[#030213]'
                                    : 'bg-white text-neutral-600 hover:text-neutral-950 border-neutral-200'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: COHORT ACCOUNTABILITY MATRIX */}
            {tab === 'matrix' && overview && (
                <div className="bg-white border border-neutral-200 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                            <tr>
                                <th className="p-3.5 sticky left-0 bg-neutral-50 z-10 min-w-[200px] uppercase tracking-wider text-[10px] font-bold">Team Member</th>
                                <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Progress</th>
                                <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Watch / Read</th>
                                <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Streak / Idle</th>
                                <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Status</th>
                                <th className="p-3.5 min-w-[260px] uppercase tracking-wider text-[10px] font-bold">28-Module Heatmap</th>
                                <th className="p-3.5 text-right uppercase tracking-wider text-[10px] font-bold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200/80">
                            {overview.learners.map((l: any) => (
                                <tr key={l.userId} className="hover:bg-neutral-50/70">
                                    <td className="p-3.5 sticky left-0 bg-white">
                                        <div className="font-semibold text-neutral-950">{l.fullName}</div>
                                        <div className="text-[11px] text-neutral-500">{l.email}</div>
                                    </td>
                                    <td className="p-3.5">
                                        <div className="font-bold text-neutral-950">{l.progressPct}%</div>
                                        <div className="text-[11px] text-neutral-500">
                                            {l.completedLessons}/{l.totalLessons}
                                        </div>
                                    </td>
                                    <td className="p-3.5 text-neutral-700">
                                        {l.watchedMinutes}m vid · {l.readingMinutes}m read
                                    </td>
                                    <td className="p-3.5">
                                        <span className="text-amber-700 font-semibold">{l.streak}d</span>
                                        <span className="text-neutral-500"> · {l.daysInactive}d idle</span>
                                    </td>
                                    <td className="p-3.5">
                                        <span
                                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                                l.riskStatus === 'on_track'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : l.riskStatus === 'behind'
                                                      ? 'bg-amber-100 text-amber-800'
                                                      : 'bg-red-100 text-red-800'
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
                                                    className={`w-3.5 h-3.5 ${
                                                        cell.status === 'completed'
                                                            ? 'bg-emerald-600'
                                                            : cell.status === 'in_progress'
                                                              ? 'bg-neutral-900'
                                                              : cell.status === 'drip_locked'
                                                                ? 'bg-neutral-100 border border-neutral-200'
                                                                : 'bg-amber-200 border border-amber-300'
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
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#030213] hover:bg-neutral-800 text-white font-semibold"
                                        >
                                            <BellRing className="w-3.5 h-3.5" /> Nudge
                                        </button>
                                        <button
                                            onClick={() => handleGrantDripOverride(l.userId, l.fullName)}
                                            title="Bypass Monday drip lock for this member"
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-neutral-300 hover:border-neutral-950 text-neutral-700"
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
                        <div className="bg-white border border-neutral-200 p-8 text-center text-sm text-neutral-500">
                            No project deliverables submitted yet.
                        </div>
                    ) : (
                        reviews.map((sub) => (
                            <div key={sub.id} className="bg-white border border-neutral-200 p-5 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <div className="text-sm font-semibold text-neutral-950">
                                            {sub.learner_name} · <span className="text-neutral-600">{sub.lesson_title}</span>
                                        </div>
                                        <div className="text-xs text-neutral-500">
                                            {sub.module_title} · Submitted {new Date(sub.submitted_at).toLocaleString()}
                                        </div>
                                    </div>
                                    <span
                                        className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                            sub.review_status === 'approved'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : sub.review_status === 'revision_requested'
                                                  ? 'bg-amber-100 text-amber-800'
                                                  : 'bg-neutral-200 text-neutral-800'
                                        }`}
                                    >
                                        {sub.review_status.replace('_', ' ')}
                                    </span>
                                </div>

                                <p className="text-xs text-neutral-700 bg-neutral-50 p-3.5 border border-neutral-200">
                                    {sub.reflection_notes}
                                </p>

                                <div className="flex flex-wrap gap-3 text-xs">
                                    {sub.download_url && (
                                        <a
                                            href={sub.download_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 border border-neutral-300 hover:border-neutral-950 text-neutral-900 font-medium"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            Download {sub.file_name || 'File'}
                                        </a>
                                    )}
                                    {sub.external_url && (
                                        <a
                                            href={sub.external_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 border border-neutral-300 hover:border-neutral-950 text-neutral-900 font-medium"
                                        >
                                            Open External Link <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-neutral-200">
                                    <input
                                        type="text"
                                        value={feedbackMap[sub.id] ?? sub.reviewer_feedback ?? ''}
                                        onChange={(e) => setFeedbackMap((p) => ({ ...p, [sub.id]: e.target.value }))}
                                        placeholder="Enter constructive review feedback..."
                                        className="flex-1 bg-white border border-neutral-300 px-3 py-2 text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                    />
                                    <button
                                        onClick={() => handleReview(sub.id, 'approved')}
                                        className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                    </button>
                                    <button
                                        onClick={() => handleReview(sub.id, 'revision_requested')}
                                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5"
                                    >
                                        <AlertTriangle className="w-3.5 h-3.5" /> Request Revision
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* TAB 3: DIRECT ACCOUNT CREATION, PASSWORD/BLOCK CONTROLS & MONDAY DRIP */}
            {tab === 'team' && (
                <div className="space-y-6">
                    {/* Credentials Ready Banner (shown after creating account or changing password) */}
                    {credsBox && (
                        <div className="bg-[#030213] text-white p-5 border border-neutral-900 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">
                                    {credsBox.isReset ? 'Password Updated — Ready to Share' : 'Access Account Created — Ready to Share'}
                                </div>
                                <button
                                    onClick={() => setCredsBox(null)}
                                    className="text-xs text-neutral-400 hover:text-white"
                                >
                                    Dismiss
                                </button>
                            </div>
                            <div className="grid sm:grid-cols-3 gap-3 text-xs bg-white/5 border border-white/10 p-3.5">
                                <div>
                                    <div className="text-neutral-400 text-[10px] uppercase tracking-wider">Portal URL</div>
                                    <div className="font-mono text-white mt-0.5 truncate">{credsBox.loginUrl}</div>
                                </div>
                                <div>
                                    <div className="text-neutral-400 text-[10px] uppercase tracking-wider">Email Address</div>
                                    <div className="font-mono text-white mt-0.5">{credsBox.email}</div>
                                </div>
                                <div>
                                    <div className="text-neutral-400 text-[10px] uppercase tracking-wider">Password</div>
                                    <div className="font-mono text-emerald-300 font-semibold mt-0.5">{credsBox.password}</div>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <button
                                    onClick={handleCopyCreds}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-neutral-100 text-[#030213] text-xs font-bold uppercase tracking-[0.14em]"
                                >
                                    {copiedCreds ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedCreds ? 'Copied!' : 'Copy Login Details'}
                                </button>
                                <button
                                    onClick={handleEmailCredsNow}
                                    disabled={emailingCreds}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold uppercase tracking-[0.14em]"
                                >
                                    <Mail className="w-3.5 h-3.5" />
                                    {emailingCreds
                                        ? 'Sending...'
                                        : credsBox.emailed
                                          ? 'Resend Credentials via Email'
                                          : 'Send Credentials via Email'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid lg:grid-cols-2 gap-6">
                        {/* Create Access Account Form */}
                        <form onSubmit={handleCreateAccount} className="bg-white border border-neutral-200 p-5 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-900 flex items-center gap-2">
                                <UserPlus className="w-4 h-4" /> Create Team Access Account
                            </h3>

                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="Adaeze Okafor"
                                        className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        placeholder="name@example.com"
                                        className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                    />
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Team Role</label>
                                    <input
                                        type="text"
                                        value={newJobRole}
                                        onChange={(e) => setNewJobRole(e.target.value)}
                                        placeholder="Product / Engineering / Design"
                                        className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Portal Role</label>
                                    <select
                                        value={newRole}
                                        onChange={(e) => setNewRole(e.target.value as any)}
                                        className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs text-neutral-950"
                                    >
                                        <option value="learner">Learner</option>
                                        <option value="admin">Cohort Admin</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                                        Initial Password (min 8 chars)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setNewPassword(generateStrongPassword())}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-700 hover:text-neutral-950"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Generate
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showNewPwd ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-white border border-neutral-300 px-3 py-2 pr-10 text-xs font-mono text-neutral-950 focus:outline-none focus:border-neutral-950"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPwd((p) => !p)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-950"
                                    >
                                        {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <label className="flex items-center gap-2.5 text-xs text-neutral-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={sendCredsOnCreate}
                                    onChange={(e) => setSendCredsOnCreate(e.target.checked)}
                                    className="accent-neutral-950"
                                />
                                <span>Also email these login credentials immediately (otherwise copy manually)</span>
                            </label>

                            <button
                                type="submit"
                                disabled={creatingAccount}
                                className="w-full py-2.5 px-4 bg-[#030213] hover:bg-neutral-800 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-[0.16em]"
                            >
                                {creatingAccount ? 'Creating Account...' : 'Create Access Account'}
                            </button>
                        </form>

                        {/* Cohort Start Date & Weekly Monday Drip */}
                        <form onSubmit={handleSaveCohort} className="bg-white border border-neutral-200 p-5 space-y-4 h-fit">
                            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-900">
                                Cohort Start Date & Weekly Monday Drip
                            </h3>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-neutral-600">Week 1 Start Date (Pick a Monday)</label>
                                    <input
                                        type="date"
                                        value={cohortStart}
                                        onChange={(e) => setCohortStart(e.target.value)}
                                        className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs text-neutral-950"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-neutral-600">Pacing Mode</label>
                                    <select
                                        value={cohortPacing}
                                        onChange={(e) => setCohortPacing(e.target.value)}
                                        className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs text-neutral-950"
                                    >
                                        <option value="weekly_drip_sequential">Sequential + Weekly Monday Drip</option>
                                        <option value="self_paced_sequential">Pure Sequential Self-Paced</option>
                                    </select>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={savingCohort}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.16em]"
                            >
                                <Save className="w-3.5 h-3.5" /> Save Schedule
                            </button>
                        </form>
                    </div>

                    {/* Manage All Accounts: Change Password, Temp Block, Perm Block, Peer Buddies */}
                    <div className="bg-white border border-neutral-200 overflow-x-auto">
                        <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-900">
                                Manage Team Accounts ({members.length})
                            </h3>
                        </div>
                        <table className="w-full text-left text-xs">
                            <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                                <tr>
                                    <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Member</th>
                                    <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Role</th>
                                    <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Access Status</th>
                                    <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Peer Buddy</th>
                                    <th className="p-3.5 text-right uppercase tracking-wider text-[10px] font-bold">Access Controls</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200/80">
                                {members.map((m) => {
                                    const isSelf = m.user_id === user?.id;
                                    return (
                                        <tr key={m.id} className="hover:bg-neutral-50/70">
                                            <td className="p-3.5">
                                                <div className="font-semibold text-neutral-950">{m.full_name}</div>
                                                <div className="text-[11px] text-neutral-500">{m.email}</div>
                                            </td>
                                            <td className="p-3.5 capitalize text-neutral-700">
                                                {m.role} · <span className="text-neutral-500">{m.job_role}</span>
                                            </td>
                                            <td className="p-3.5">
                                                <span
                                                    className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                                        m.status === 'active'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : m.status === 'paused'
                                                              ? 'bg-amber-100 text-amber-800'
                                                              : 'bg-red-100 text-red-800'
                                                    }`}
                                                >
                                                    {m.status === 'paused'
                                                        ? 'Temp Blocked'
                                                        : m.status === 'removed'
                                                          ? 'Perm Blocked'
                                                          : 'Active'}
                                                </span>
                                            </td>
                                            <td className="p-3.5">
                                                <select
                                                    value={m.peer_buddy_user_id || ''}
                                                    onChange={(e) => handleAssignBuddy(m.id, e.target.value)}
                                                    className="bg-white border border-neutral-300 px-2 py-1 text-xs text-neutral-900"
                                                >
                                                    <option value="">None</option>
                                                    {members
                                                        .filter((other) => other.user_id !== m.user_id && other.status === 'active')
                                                        .map((other) => (
                                                            <option key={other.user_id} value={other.user_id}>
                                                                {other.full_name}
                                                            </option>
                                                        ))}
                                                </select>
                                            </td>
                                            <td className="p-3.5 text-right whitespace-nowrap space-x-1.5">
                                                <button
                                                    onClick={() => {
                                                        setPwdTarget(m);
                                                        setResetPwdValue(generateStrongPassword());
                                                        setEmailOnReset(false);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-neutral-300 hover:border-neutral-950 text-neutral-800 font-semibold"
                                                >
                                                    <KeyRound className="w-3.5 h-3.5" /> Password
                                                </button>

                                                {!isSelf && m.status === 'active' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleSetMemberStatus(m, 'paused')}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold"
                                                        >
                                                            <PauseCircle className="w-3.5 h-3.5" /> Temp Block
                                                        </button>
                                                        <button
                                                            onClick={() => handleSetMemberStatus(m, 'removed')}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 border border-red-300 hover:bg-red-100 text-red-800 font-semibold"
                                                        >
                                                            <Ban className="w-3.5 h-3.5" /> Perm Block
                                                        </button>
                                                    </>
                                                )}

                                                {!isSelf && m.status === 'paused' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleSetMemberStatus(m, 'active')}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-900 font-semibold"
                                                        >
                                                            <PlayCircle className="w-3.5 h-3.5" /> Restore
                                                        </button>
                                                        <button
                                                            onClick={() => handleSetMemberStatus(m, 'removed')}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 border border-red-300 hover:bg-red-100 text-red-800 font-semibold"
                                                        >
                                                            <Ban className="w-3.5 h-3.5" /> Perm Block
                                                        </button>
                                                    </>
                                                )}

                                                {!isSelf && m.status === 'removed' && (
                                                    <button
                                                        onClick={() => handleSetMemberStatus(m, 'active')}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-neutral-300 hover:border-neutral-950 text-neutral-800 font-semibold"
                                                    >
                                                        <PlayCircle className="w-3.5 h-3.5" /> Unban & Restore
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: QUIZ ANSWER KEY VERIFICATION */}
            {tab === 'quizzes' && (
                <div className="grid lg:grid-cols-3 gap-6 items-start">
                    <div className="bg-white border border-neutral-200 p-4 space-y-2 max-h-[600px] overflow-y-auto">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500 px-2 pb-1">
                            All Practice Quizzes ({quizzes.length})
                        </h3>
                        {quizzes.map((q: any) => (
                            <button
                                key={q.id}
                                onClick={() => handleOpenQuizEditor(q.id)}
                                className={`w-full text-left p-3 border text-xs transition ${
                                    selectedQuiz?.id === q.id
                                        ? 'bg-[#030213] border-[#030213] text-white'
                                        : 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:border-neutral-400'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium truncate">{q.title}</span>
                                    <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                            q.quiz_keys_verified ? 'bg-emerald-500' : 'bg-amber-500'
                                        }`}
                                    />
                                </div>
                                <div
                                    className={`text-[11px] mt-0.5 truncate ${
                                        selectedQuiz?.id === q.id ? 'text-neutral-300' : 'text-neutral-500'
                                    }`}
                                >
                                    W{q.lms_modules?.target_week} · {q.lms_modules?.title}
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="lg:col-span-2 bg-white border border-neutral-200 p-6">
                        {!selectedQuiz ? (
                            <p className="text-sm text-neutral-500 py-12 text-center">
                                Select a quiz on the left to review parsed questions and lock the official answer key.
                            </p>
                        ) : (
                            <div className="space-y-5">
                                <div className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-4">
                                    <div>
                                        <h3 className="text-base font-semibold text-neutral-950">{selectedQuiz.title}</h3>
                                        <p className="text-xs text-neutral-500">
                                            Click the correct option(s) for each question, then Save & Lock.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleSaveQuizKeys}
                                        className="px-4 py-2.5 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center gap-1.5"
                                    >
                                        <Save className="w-3.5 h-3.5" /> Save & Lock Key
                                    </button>
                                </div>

                                <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
                                    {(selectedQuiz.quiz_questions_json || []).map((q: any, qIdx: number) => (
                                        <div key={q.id} className="p-4 bg-neutral-50 border border-neutral-200 space-y-2.5">
                                            <p className="text-xs font-semibold text-neutral-950">
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
                                                            className={`w-full text-left px-3 py-2 border text-xs transition ${
                                                                isCorrect
                                                                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-semibold'
                                                                    : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400'
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

            {/* Change Password Modal */}
            {pwdTarget && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <form
                        onSubmit={handleResetPasswordSubmit}
                        className="w-full max-w-md bg-white border border-neutral-200 p-6 space-y-4 shadow-xl"
                    >
                        <div>
                            <h3 className="text-base font-semibold text-neutral-950">
                                Change Password — {pwdTarget.full_name}
                            </h3>
                            <p className="text-xs text-neutral-500">{pwdTarget.email}</p>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                                    New Password (min 8 chars)
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setResetPwdValue(generateStrongPassword())}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-700 hover:text-neutral-950"
                                >
                                    <RefreshCw className="w-3 h-3" /> Generate
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type={showResetPwd ? 'text' : 'password'}
                                    required
                                    minLength={8}
                                    value={resetPwdValue}
                                    onChange={(e) => setResetPwdValue(e.target.value)}
                                    className="w-full bg-white border border-neutral-300 px-3 py-2.5 pr-10 text-sm font-mono text-neutral-950 focus:outline-none focus:border-neutral-950"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowResetPwd((p) => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-950"
                                >
                                    {showResetPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <label className="flex items-center gap-2.5 text-xs text-neutral-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={emailOnReset}
                                onChange={(e) => setEmailOnReset(e.target.checked)}
                                className="accent-neutral-950"
                            />
                            <span>Also email the updated login credentials to {pwdTarget.email}</span>
                        </label>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setPwdTarget(null)}
                                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={savingResetPwd}
                                className="px-4 py-2 bg-[#030213] hover:bg-neutral-800 text-xs font-bold uppercase tracking-[0.14em] text-white"
                            >
                                {savingResetPwd ? 'Updating...' : 'Update Password'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Personal Nudge Modal */}
            {nudgeTarget && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <form
                        onSubmit={handleSendNudge}
                        className="w-full max-w-md bg-white border border-neutral-200 p-6 space-y-4 shadow-xl"
                    >
                        <h3 className="text-base font-semibold text-neutral-950">
                            Send Personal Nudge to {nudgeTarget.fullName}
                        </h3>
                        <textarea
                            rows={4}
                            required
                            value={nudgeMsg}
                            onChange={(e) => setNudgeMsg(e.target.value)}
                            className="w-full bg-white border border-neutral-300 p-3 text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setNudgeTarget(null)}
                                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={sendingNudge}
                                className="px-4 py-2 bg-[#030213] hover:bg-neutral-800 text-xs font-bold uppercase tracking-[0.14em] text-white"
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
