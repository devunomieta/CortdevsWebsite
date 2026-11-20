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
    Shield,
    ShieldCheck,
    ShieldOff,
    Unlock,
    UserPlus,
    Users,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLearnAuth } from '../context/LearnAuthContext';
import { learnApi } from '../lib/api';

type AdminTab = 'matrix' | 'reviews' | 'team' | 'quizzes';

const ROOT_ADMIN_EMAIL = 'learn@cortdevs.com';

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

function addDaysIso(isoDate: string, days: number): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '';
    const ms = new Date(`${isoDate}T00:00:00Z`).getTime() + days * 86400 * 1000;
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

    // Direct Account Creation Form
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newJobRole, setNewJobRole] = useState('Team Member');
    const [newRole, setNewRole] = useState<'learner' | 'admin'>('learner');
    const [newPassword, setNewPassword] = useState(() => generateStrongPassword());
    const [showNewPwd, setShowNewPwd] = useState(true);
    const [sendCredsOnCreate, setSendCredsOnCreate] = useState(false);
    const [creatingAccount, setCreatingAccount] = useState(false);

    // Latest generated/updated credentials card
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

    // Course Start Date & Schedule Form
    const [cohortStart, setCohortStart] = useState('');
    const [cohortEnd, setCohortEnd] = useState('');
    const [cohortPacing, setCohortPacing] = useState('weekly_drip_sequential');
    const [savingCohort, setSavingCohort] = useState(false);

    // Nudge modal state
    const [nudgeTarget, setNudgeTarget] = useState<any | null>(null);
    const [nudgeMsg, setNudgeMsg] = useState('');
    const [sendingNudge, setSendingNudge] = useState(false);

    const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});

    const actorIsRootAdmin = (user?.email || '').toLowerCase() === ROOT_ADMIN_EMAIL;

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
            setCohortEnd(ov.cohort?.target_end_date || '');
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
                    ? 'Account created and login details emailed!'
                    : 'Account created! Copy the login details below or send via email.',
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
        const text = `CortDevs Learn — Login Details\nPortal URL: ${credsBox.loginUrl}\nEmail Address: ${credsBox.email}\nPassword: ${credsBox.password}`;
        await navigator.clipboard.writeText(text);
        setCopiedCreds(true);
        showToast('Login details copied to clipboard!');
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
            showToast(`Login details emailed to ${credsBox.email}!`);
        } catch (err: any) {
            showToast(err?.message || 'Failed to email login details');
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
                    : `Password updated for ${pwdTarget.full_name}.`,
            );
        } catch (err: any) {
            showToast(err?.message || 'Password update failed');
        } finally {
            setSavingResetPwd(false);
        }
    };

    const handleToggleAdminRole = async (member: any) => {
        const nextRole = member.role === 'admin' ? 'learner' : 'admin';
        const label = nextRole === 'admin' ? 'make this user an Admin' : 'remove Admin access from this user';
        if (!window.confirm(`Are you sure you want to ${label} (${member.full_name})?`)) return;
        try {
            await learnApi('admin/lms/members', {
                method: 'PATCH',
                body: {
                    action: 'set_role',
                    targetUserId: member.user_id,
                    role: nextRole,
                },
            });
            showToast(
                nextRole === 'admin'
                    ? `${member.full_name} is now an Admin.`
                    : `Admin access removed from ${member.full_name}.`,
            );
            loadAll();
        } catch (err: any) {
            showToast(err?.message || 'Failed to update role');
        }
    };

    const handleSetMemberStatus = async (member: any, nextStatus: 'active' | 'paused' | 'removed') => {
        if (nextStatus === 'removed') {
            const ok = window.confirm(
                `Permanently block ${member.full_name} (${member.email})? They will no longer be able to sign in.`,
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
                body: {
                    start_date: cohortStart,
                    target_end_date: cohortEnd || undefined,
                    pacing_mode: cohortPacing,
                },
            });
            showToast('Course start date and weekly schedule updated!');
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
        showToast('Study partner updated!');
        loadAll();
    };

    const handleReview = async (submissionId: string, status: 'approved' | 'revision_requested') => {
        try {
            await learnApi('admin/lms/reviews', {
                method: 'PATCH',
                body: { submissionId, reviewStatus: status, feedback: feedbackMap[submissionId] || '' },
            });
            showToast(`Project marked as ${status.replace('_', ' ')} and teammate notified!`);
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
            showToast(`Reminder sent to ${nudgeTarget.fullName}!`);
            setNudgeTarget(null);
            setNudgeMsg('');
        } catch (err: any) {
            showToast(err?.message || 'Could not send message');
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
                reason: 'Admin unlocked upcoming weeks early',
            },
        });
        showToast(`Upcoming weeks unlocked early for ${fullName}.`);
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
        showToast('Quiz answers saved!');
        setSelectedQuiz(null);
        loadAll();
    };

    const handleExportPdf = () => {
        if (!overview) return;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text(`CortDevs Learn — Team Progress Report`, 14, 18);
        doc.setFontSize(10);
        doc.text(
            `${overview.cohort.name} | Date: ${new Date().toLocaleDateString()} | This Week's Goal: ${overview.summary.targetPct}%`,
            14,
            25,
        );
        autoTable(doc, {
            startY: 32,
            head: [['Team Member', 'Email', 'Progress', 'Video (min)', 'Reading (min)', 'Avg Quiz', 'Streak', 'Last Active', 'Status']],
            body: overview.learners.map((l: any) => [
                l.fullName,
                l.email,
                `${l.progressPct}% (${l.completedLessons}/${l.totalLessons})`,
                `${l.watchedMinutes}m`,
                `${l.readingMinutes}m`,
                l.avgQuizScore !== null ? `${l.avgQuizScore}%` : '—',
                `${l.streak}d`,
                `${l.daysInactive}d ago`,
                l.riskStatus.replace('_', ' ').toUpperCase(),
            ]),
        });
        doc.save(`cortdevs-learn-progress-${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    if (loading) {
        return (
            <div className="py-20 flex items-center justify-center gap-3 text-neutral-500">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-950" />
                <span className="text-xs uppercase tracking-[0.2em]">Loading team dashboard...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-light tracking-tight text-neutral-950 flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-neutral-900 shrink-0" />
                        Team <span className="font-semibold">Dashboard</span>
                    </h1>
                    <p className="text-sm text-neutral-500">{overview?.cohort?.name}</p>
                </div>

                <button
                    onClick={handleExportPdf}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#030213] hover:bg-neutral-800 text-xs font-bold uppercase tracking-[0.16em] text-white transition"
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
                    <div className="bg-white border border-neutral-200 p-3.5 sm:p-4">
                        <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">Active Members</div>
                        <div className="text-xl sm:text-2xl font-semibold text-neutral-950 mt-1">{overview.summary.totalLearners}</div>
                    </div>
                    <div className="bg-white border border-neutral-200 p-3.5 sm:p-4">
                        <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">Avg vs Goal</div>
                        <div className="text-xl sm:text-2xl font-semibold text-neutral-950 mt-1">
                            {overview.summary.avgProgressPct}%{' '}
                            <span className="text-xs text-neutral-400 font-normal">/ {overview.summary.targetPct}%</span>
                        </div>
                    </div>
                    <div className="bg-white border border-neutral-200 p-3.5 sm:p-4">
                        <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">Needs Check-In</div>
                        <div className="text-xl sm:text-2xl font-semibold text-amber-700 mt-1">{overview.summary.atRiskCount}</div>
                    </div>
                    <div className="bg-white border border-neutral-200 p-3.5 sm:p-4">
                        <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">Projects to Review</div>
                        <div className="text-xl sm:text-2xl font-semibold text-neutral-950 mt-1">{overview.summary.pendingReviewsCount}</div>
                    </div>
                    <div className="col-span-2 lg:col-span-1 bg-white border border-neutral-200 p-3.5 sm:p-4">
                        <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">Quiz Answers Set</div>
                        <div className="text-xl sm:text-2xl font-semibold text-emerald-700 mt-1">
                            {overview.summary.totalQuizzesCount - overview.summary.unverifiedQuizzesCount}{' '}
                            <span className="text-xs text-neutral-400 font-normal">/ {overview.summary.totalQuizzesCount}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Bar */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 overflow-x-auto">
                {[
                    { id: 'matrix', label: 'Team Progress', icon: Users },
                    { id: 'reviews', label: `Project Reviews (${overview?.summary?.pendingReviewsCount || 0})`, icon: FolderCheck },
                    { id: 'team', label: `Team & Schedule (${members.length})`, icon: Calendar },
                    { id: 'quizzes', label: `Quiz Answers (${overview?.summary?.unverifiedQuizzesCount || 0} left)`, icon: FileQuestion },
                ].map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id as AdminTab)}
                            className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] whitespace-nowrap transition border ${
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

            {/* TAB 1: TEAM PROGRESS */}
            {tab === 'matrix' && overview && (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block bg-white border border-neutral-200 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                                <tr>
                                    <th className="p-3.5 sticky left-0 bg-neutral-50 z-10 min-w-[200px] uppercase tracking-wider text-[10px] font-bold">Team Member</th>
                                    <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Progress</th>
                                    <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Time Spent</th>
                                    <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Streak / Idle</th>
                                    <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Pace</th>
                                    <th className="p-3.5 min-w-[250px] uppercase tracking-wider text-[10px] font-bold">28 Modules</th>
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
                                            {l.watchedMinutes}m video · {l.readingMinutes}m reading
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
                                                {l.riskStatus === 'at_risk' ? 'Needs Check-In' : l.riskStatus.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-3.5">
                                            <div className="flex flex-wrap gap-1">
                                                {l.moduleMatrix.map((cell: any) => (
                                                    <div
                                                        key={cell.moduleId}
                                                        title={`Module ${cell.globalOrder} (Week ${cell.targetWeek}): ${cell.done}/${cell.total}`}
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
                                                    setNudgeMsg(`Hey ${l.fullName.split(' ')[0]}, checking in on your course progress this week — let me know if you need any help!`);
                                                }}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#030213] hover:bg-neutral-800 text-white font-semibold"
                                            >
                                                <BellRing className="w-3.5 h-3.5" /> Remind
                                            </button>
                                            <button
                                                onClick={() => handleGrantDripOverride(l.userId, l.fullName)}
                                                title="Unlock upcoming weeks early for this person"
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

                    {/* Mobile Stacked Cards */}
                    <div className="md:hidden space-y-3">
                        {overview.learners.map((l: any) => (
                            <div key={l.userId} className="bg-white border border-neutral-200 p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-semibold text-sm text-neutral-950 truncate">{l.fullName}</div>
                                        <div className="text-xs text-neutral-500 truncate">{l.email}</div>
                                    </div>
                                    <span
                                        className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                                            l.riskStatus === 'on_track'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : l.riskStatus === 'behind'
                                                  ? 'bg-amber-100 text-amber-800'
                                                  : 'bg-red-100 text-red-800'
                                        }`}
                                    >
                                        {l.riskStatus === 'at_risk' ? 'Needs Check-In' : l.riskStatus.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs bg-neutral-50 border border-neutral-200 p-2.5">
                                    <div>
                                        <div className="text-[10px] text-neutral-500 uppercase">Progress</div>
                                        <div className="font-bold text-neutral-950">{l.progressPct}%</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-neutral-500 uppercase">Video / Read</div>
                                        <div className="font-medium text-neutral-800">{l.watchedMinutes}m / {l.readingMinutes}m</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-neutral-500 uppercase">Streak</div>
                                        <div className="font-semibold text-amber-700">{l.streak}d ({l.daysInactive}d idle)</div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {l.moduleMatrix.map((cell: any) => (
                                        <div
                                            key={cell.moduleId}
                                            className={`w-3 h-3 ${
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
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => {
                                            setNudgeTarget(l);
                                            setNudgeMsg(`Hey ${l.fullName.split(' ')[0]}, checking in on your course progress this week — let me know if you need any help!`);
                                        }}
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#030213] text-white text-xs font-semibold"
                                    >
                                        <BellRing className="w-3.5 h-3.5" /> Send Reminder
                                    </button>
                                    <button
                                        onClick={() => handleGrantDripOverride(l.userId, l.fullName)}
                                        className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-white border border-neutral-300 text-xs font-semibold text-neutral-800"
                                    >
                                        <Unlock className="w-3.5 h-3.5" /> Unlock Early
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* TAB 2: PROJECT REVIEWS */}
            {tab === 'reviews' && (
                <div className="space-y-4">
                    {reviews.length === 0 ? (
                        <div className="bg-white border border-neutral-200 p-8 text-center text-sm text-neutral-500">
                            No project assignments submitted yet.
                        </div>
                    ) : (
                        reviews.map((sub) => (
                            <div key={sub.id} className="bg-white border border-neutral-200 p-4 sm:p-5 space-y-3">
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
                                            Open Link <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-neutral-200">
                                    <input
                                        type="text"
                                        value={feedbackMap[sub.id] ?? sub.reviewer_feedback ?? ''}
                                        onChange={(e) => setFeedbackMap((p) => ({ ...p, [sub.id]: e.target.value }))}
                                        placeholder="Write helpful feedback for your teammate..."
                                        className="flex-1 bg-white border border-neutral-300 px-3 py-2 text-base sm:text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleReview(sub.id, 'approved')}
                                            className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                        </button>
                                        <button
                                            onClick={() => handleReview(sub.id, 'revision_requested')}
                                            className="flex-1 sm:flex-none px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5"
                                        >
                                            <AlertTriangle className="w-3.5 h-3.5" /> Needs Changes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* TAB 3: TEAM ACCOUNTS, ADMIN ROLES, BLOCKING & COURSE START DATE */}
            {tab === 'team' && (
                <div className="space-y-6">
                    {/* Credentials Ready Banner */}
                    {credsBox && (
                        <div className="bg-[#030213] text-white p-4 sm:p-5 border border-neutral-900 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">
                                    {credsBox.isReset ? 'Password Updated — Ready to Share' : 'Account Created — Ready to Share'}
                                </div>
                                <button onClick={() => setCredsBox(null)} className="text-xs text-neutral-400 hover:text-white">
                                    Dismiss
                                </button>
                            </div>
                            <div className="grid sm:grid-cols-3 gap-3 text-xs bg-white/5 border border-white/10 p-3.5">
                                <div>
                                    <div className="text-neutral-400 text-[10px] uppercase tracking-wider">Login Link</div>
                                    <div className="font-mono text-white mt-0.5 break-all">{credsBox.loginUrl}</div>
                                </div>
                                <div>
                                    <div className="text-neutral-400 text-[10px] uppercase tracking-wider">Email Address</div>
                                    <div className="font-mono text-white mt-0.5 break-all">{credsBox.email}</div>
                                </div>
                                <div>
                                    <div className="text-neutral-400 text-[10px] uppercase tracking-wider">Password</div>
                                    <div className="font-mono text-emerald-300 font-semibold mt-0.5 break-all">{credsBox.password}</div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2.5">
                                <button
                                    onClick={handleCopyCreds}
                                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-neutral-100 text-[#030213] text-xs font-bold uppercase tracking-[0.14em]"
                                >
                                    {copiedCreds ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedCreds ? 'Copied!' : 'Copy Login Details'}
                                </button>
                                <button
                                    onClick={handleEmailCredsNow}
                                    disabled={emailingCreds}
                                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold uppercase tracking-[0.14em]"
                                >
                                    <Mail className="w-3.5 h-3.5" />
                                    {emailingCreds
                                        ? 'Sending...'
                                        : credsBox.emailed
                                          ? 'Resend by Email'
                                          : 'Send by Email'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid lg:grid-cols-2 gap-6">
                        {/* Create Team Member Account */}
                        <form onSubmit={handleCreateAccount} className="bg-white border border-neutral-200 p-4 sm:p-5 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-900 flex items-center gap-2">
                                <UserPlus className="w-4 h-4" /> Add Team Member
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
                                        className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-base sm:text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
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
                                        className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-base sm:text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                    />
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Job Title / Team</label>
                                    <input
                                        type="text"
                                        value={newJobRole}
                                        onChange={(e) => setNewJobRole(e.target.value)}
                                        placeholder="Product / Engineering / Design"
                                        className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-base sm:text-xs text-neutral-950 focus:outline-none focus:border-neutral-950"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Account Type</label>
                                    <select
                                        value={newRole}
                                        onChange={(e) => setNewRole(e.target.value as any)}
                                        className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-base sm:text-xs text-neutral-950"
                                    >
                                        <option value="learner">Learner</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                                        Password (min 8 chars)
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
                                        className="w-full bg-white border border-neutral-300 px-3 py-2.5 pr-10 text-base sm:text-xs font-mono text-neutral-950 focus:outline-none focus:border-neutral-950"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPwd((p) => !p)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-950 p-1"
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
                                <span>Also email login details immediately (or leave unchecked to copy manually)</span>
                            </label>

                            <button
                                type="submit"
                                disabled={creatingAccount}
                                className="w-full py-3 px-4 bg-[#030213] hover:bg-neutral-800 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-[0.16em]"
                            >
                                {creatingAccount ? 'Creating Account...' : 'Create Account'}
                            </button>
                        </form>

                        {/* Course Start Date & Weekly Unlock Schedule */}
                        <form onSubmit={handleSaveCohort} className="bg-white border border-neutral-200 p-4 sm:p-5 space-y-4 h-fit">
                            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-900">
                                Course Start Date & Weekly Schedule
                            </h3>
                            <p className="text-xs text-neutral-500">
                                Pick the Monday your team starts. Every new week of lessons unlocks 7 days apart at 7:00 AM WAT so everyone stays in sync.
                            </p>

                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                                        Course Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={cohortStart}
                                        onChange={(e) => setCohortStart(e.target.value)}
                                        className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-base sm:text-xs text-neutral-950"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                                        Target Finish Date
                                    </label>
                                    <input
                                        type="date"
                                        value={cohortEnd}
                                        onChange={(e) => setCohortEnd(e.target.value)}
                                        className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-base sm:text-xs text-neutral-950"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                                    Lesson Unlock Style
                                </label>
                                <select
                                    value={cohortPacing}
                                    onChange={(e) => setCohortPacing(e.target.value)}
                                    className="w-full bg-white border border-neutral-300 px-3 py-2.5 text-base sm:text-xs text-neutral-950"
                                >
                                    <option value="weekly_drip_sequential">Step-by-step + New Week Every Monday</option>
                                    <option value="self_paced_sequential">Step-by-step Only (No Weekly Wait)</option>
                                </select>
                            </div>

                            {cohortStart && cohortPacing === 'weekly_drip_sequential' && (
                                <div className="bg-neutral-50 border border-neutral-200 p-3 space-y-1.5">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                        Weekly Unlock Preview
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 text-[11px] text-neutral-700">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((wk) => (
                                            <div key={wk} className="bg-white border border-neutral-200 px-2 py-1">
                                                <span className="font-semibold text-neutral-950">W{wk}:</span> {addDaysIso(cohortStart, (wk - 1) * 7)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={savingCohort}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.16em]"
                            >
                                <Save className="w-3.5 h-3.5" /> {savingCohort ? 'Saving...' : 'Save Course Schedule'}
                            </button>
                        </form>
                    </div>

                    {/* MANAGE TEAM ACCOUNTS — DESKTOP TABLE */}
                    <div className="hidden md:block bg-white border border-neutral-200 overflow-x-auto">
                        <div className="p-4 border-b border-neutral-200">
                            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-900">
                                Manage Team Accounts ({members.length})
                            </h3>
                        </div>
                        <table className="w-full text-left text-xs">
                            <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                                <tr>
                                    <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Member</th>
                                    <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Role</th>
                                    <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Status</th>
                                    <th className="p-3.5 uppercase tracking-wider text-[10px] font-bold">Study Partner</th>
                                    <th className="p-3.5 text-right uppercase tracking-wider text-[10px] font-bold">Controls</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200/80">
                                {members.map((m) => {
                                    const isSelf = m.user_id === user?.id;
                                    const isRoot = m.email.toLowerCase() === ROOT_ADMIN_EMAIL;
                                    const canChangePwd = !isRoot || actorIsRootAdmin;
                                    return (
                                        <tr key={m.id} className="hover:bg-neutral-50/70">
                                            <td className="p-3.5">
                                                <div className="font-semibold text-neutral-950 flex items-center gap-2">
                                                    <span>{m.full_name}</span>
                                                    {isRoot && (
                                                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[#030213] text-white">
                                                            Primary Admin
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-neutral-500">{m.email}</div>
                                            </td>
                                            <td className="p-3.5 capitalize text-neutral-700">
                                                <span className={m.role === 'admin' ? 'font-bold text-neutral-950' : ''}>{m.role}</span> ·{' '}
                                                <span className="text-neutral-500">{m.job_role}</span>
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
                                                {canChangePwd && (
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
                                                )}

                                                {!isRoot && !isSelf && m.status === 'active' && (
                                                    <button
                                                        onClick={() => handleToggleAdminRole(m)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-neutral-300 hover:border-neutral-950 text-neutral-800 font-semibold"
                                                    >
                                                        {m.role === 'admin' ? (
                                                            <>
                                                                <ShieldOff className="w-3.5 h-3.5" /> Remove Admin
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Shield className="w-3.5 h-3.5" /> Make Admin
                                                            </>
                                                        )}
                                                    </button>
                                                )}

                                                {!isRoot && !isSelf && m.status === 'active' && (
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

                                                {!isRoot && !isSelf && m.status === 'paused' && (
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

                                                {!isRoot && !isSelf && m.status === 'removed' && (
                                                    <button
                                                        onClick={() => handleSetMemberStatus(m, 'active')}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-neutral-300 hover:border-neutral-950 text-neutral-800 font-semibold"
                                                    >
                                                        <PlayCircle className="w-3.5 h-3.5" /> Restore Access
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* MANAGE TEAM ACCOUNTS — MOBILE CARDS */}
                    <div className="md:hidden space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-900">
                            Manage Team Accounts ({members.length})
                        </h3>
                        {members.map((m) => {
                            const isSelf = m.user_id === user?.id;
                            const isRoot = m.email.toLowerCase() === ROOT_ADMIN_EMAIL;
                            const canChangePwd = !isRoot || actorIsRootAdmin;
                            return (
                                <div key={m.id} className="bg-white border border-neutral-200 p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="font-semibold text-sm text-neutral-950 flex flex-wrap items-center gap-1.5">
                                                <span>{m.full_name}</span>
                                                {isRoot && (
                                                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[#030213] text-white">
                                                        Primary Admin
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-neutral-500 break-all">{m.email}</div>
                                            <div className="text-[11px] text-neutral-500 capitalize mt-0.5">
                                                {m.role} · {m.job_role}
                                            </div>
                                        </div>
                                        <span
                                            className={`px-2 py-0.5 text-[10px] font-bold uppercase shrink-0 ${
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
                                    </div>

                                    <div className="flex items-center justify-between gap-2 text-xs">
                                        <span className="text-neutral-500">Study Partner:</span>
                                        <select
                                            value={m.peer_buddy_user_id || ''}
                                            onChange={(e) => handleAssignBuddy(m.id, e.target.value)}
                                            className="bg-white border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-900"
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
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100 text-xs">
                                        {canChangePwd && (
                                            <button
                                                onClick={() => {
                                                    setPwdTarget(m);
                                                    setResetPwdValue(generateStrongPassword());
                                                    setEmailOnReset(false);
                                                }}
                                                className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-neutral-300 text-neutral-800 font-semibold"
                                            >
                                                <KeyRound className="w-3.5 h-3.5" /> Password
                                            </button>
                                        )}

                                        {!isRoot && !isSelf && m.status === 'active' && (
                                            <button
                                                onClick={() => handleToggleAdminRole(m)}
                                                className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-neutral-300 text-neutral-800 font-semibold"
                                            >
                                                {m.role === 'admin' ? (
                                                    <>
                                                        <ShieldOff className="w-3.5 h-3.5" /> Remove Admin
                                                    </>
                                                ) : (
                                                    <>
                                                        <Shield className="w-3.5 h-3.5" /> Make Admin
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        {!isRoot && !isSelf && m.status === 'active' && (
                                            <>
                                                <button
                                                    onClick={() => handleSetMemberStatus(m, 'paused')}
                                                    className="inline-flex items-center gap-1 px-3 py-2 bg-amber-50 border border-amber-300 text-amber-900 font-semibold"
                                                >
                                                    <PauseCircle className="w-3.5 h-3.5" /> Temp Block
                                                </button>
                                                <button
                                                    onClick={() => handleSetMemberStatus(m, 'removed')}
                                                    className="inline-flex items-center gap-1 px-3 py-2 bg-red-50 border border-red-300 text-red-800 font-semibold"
                                                >
                                                    <Ban className="w-3.5 h-3.5" /> Perm Block
                                                </button>
                                            </>
                                        )}

                                        {!isRoot && !isSelf && m.status !== 'active' && (
                                            <button
                                                onClick={() => handleSetMemberStatus(m, 'active')}
                                                className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-50 border border-emerald-300 text-emerald-900 font-semibold"
                                            >
                                                <PlayCircle className="w-3.5 h-3.5" /> Restore Access
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 4: QUIZ ANSWER KEYS */}
            {tab === 'quizzes' && (
                <div className="grid lg:grid-cols-3 gap-6 items-start">
                    <div className="bg-white border border-neutral-200 p-4 space-y-2 max-h-[520px] overflow-y-auto">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500 px-2 pb-1">
                            Practice Quizzes ({quizzes.length})
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
                                    Week {q.lms_modules?.target_week} · {q.lms_modules?.title}
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="lg:col-span-2 bg-white border border-neutral-200 p-4 sm:p-6">
                        {!selectedQuiz ? (
                            <p className="text-sm text-neutral-500 py-12 text-center">
                                Pick a quiz to mark the correct answers for automatic grading.
                            </p>
                        ) : (
                            <div className="space-y-5">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
                                    <div>
                                        <h3 className="text-base font-semibold text-neutral-950">{selectedQuiz.title}</h3>
                                        <p className="text-xs text-neutral-500">
                                            Tap the correct answer(s) for each question, then click Save.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleSaveQuizKeys}
                                        className="w-full sm:w-auto px-4 py-2.5 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-1.5"
                                    >
                                        <Save className="w-3.5 h-3.5" /> Save Answers
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
                                                            className={`w-full text-left px-3 py-2.5 border text-xs transition ${
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
                        className="w-full max-w-md bg-white border border-neutral-200 p-5 sm:p-6 space-y-4 shadow-xl"
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
                                    className="w-full bg-white border border-neutral-300 px-3 py-2.5 pr-10 text-base sm:text-sm font-mono text-neutral-950 focus:outline-none focus:border-neutral-950"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowResetPwd((p) => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-950 p-1"
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
                            <span>Also email the new password to {pwdTarget.email}</span>
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

            {/* Personal Reminder Modal */}
            {nudgeTarget && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <form
                        onSubmit={handleSendNudge}
                        className="w-full max-w-md bg-white border border-neutral-200 p-5 sm:p-6 space-y-4 shadow-xl"
                    >
                        <h3 className="text-base font-semibold text-neutral-950">
                            Send Reminder to {nudgeTarget.fullName}
                        </h3>
                        <textarea
                            rows={4}
                            required
                            value={nudgeMsg}
                            onChange={(e) => setNudgeMsg(e.target.value)}
                            className="w-full bg-white border border-neutral-300 p-3 text-base sm:text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
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
                                {sendingNudge ? 'Sending...' : 'Send Email'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
