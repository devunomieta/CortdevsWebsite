import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
    BookOpen,
    CalendarClock,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    FileQuestion,
    Flame,
    FolderKanban,
    Loader2,
    Lock,
    MessageSquareQuote,
    Play,
    PlayCircle,
    Sparkles,
    Target,
} from 'lucide-react';
import { learnApi } from '../lib/api';

function LessonTypeIcon({ type }: { type: string }) {
    switch (type) {
        case 'video':
            return <PlayCircle className="w-4 h-4 text-sky-400 shrink-0" />;
        case 'quiz':
            return <FileQuestion className="w-4 h-4 text-amber-400 shrink-0" />;
        case 'project':
            return <FolderKanban className="w-4 h-4 text-emerald-400 shrink-0" />;
        default:
            return <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
}

export function RoadmapDashboard() {
    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openCourses, setOpenCourses] = useState<Record<string, boolean>>({});
    const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

    useEffect(() => {
        learnApi('lms/curriculum')
            .then((res) => {
                setData(res);
                // Auto-expand the course & module containing the next unlocked lesson
                const nextId = res.nextUpLesson?.id;
                const initCourses: Record<string, boolean> = {};
                const initMods: Record<string, boolean> = {};
                for (const c of res.courses || []) {
                    const hasNext = c.modules.some((m: any) => m.lessons.some((l: any) => l.id === nextId));
                    if (hasNext || c.order_index <= 1) initCourses[c.id] = true;
                    for (const m of c.modules || []) {
                        if (m.lessons.some((l: any) => l.id === nextId)) initMods[m.id] = true;
                    }
                }
                setOpenCourses(initCourses);
                setOpenModules(initMods);
            })
            .catch((err) => setError(err?.message || 'Failed to load curriculum'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="py-20 flex items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                <span className="text-sm">Loading your cohort roadmap...</span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-200 text-sm">
                {error || 'Unable to load roadmap. Have you seeded the course curriculum yet?'}
            </div>
        );
    }

    const { stats, nextUpLesson, courses, teamFeed, cohort } = data;
    const paceDelta = stats.progressPct - stats.targetPct;

    return (
        <div className="space-y-8">
            {/* Hero / Next Lesson CTA */}
            <div className="relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/70 p-6 sm:p-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Week {stats.currentWeek} of 12 · Sequential + Weekly Monday Drip</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                            {nextUpLesson ? `Up Next: ${nextUpLesson.title}` : 'All Dripped Lessons Complete!'}
                        </h1>
                        <p className="text-sm text-slate-300">
                            {nextUpLesson
                                ? `${nextUpLesson.module_title} · Est. ${nextUpLesson.estimated_minutes} min · Complete sequentially to unlock the next step.`
                                : 'You have completed every module unlocked so far! New modules drip every Monday at 7:00 AM WAT.'}
                        </p>
                    </div>

                    {nextUpLesson && (
                        <Link
                            to={`/lesson/${nextUpLesson.id}`}
                            className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition"
                        >
                            <Play className="w-4 h-4 fill-current" />
                            Continue Learning
                        </Link>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="mt-6 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">
                            Overall Program Mastery: <strong className="text-white">{stats.progressPct}%</strong> ({stats.completedLessons}/{stats.totalLessons} lessons)
                        </span>
                        <span className={paceDelta >= 0 ? 'text-emerald-400 font-medium' : 'text-amber-300 font-medium'}>
                            Cohort Target Today: {stats.targetPct}% ({paceDelta >= 0 ? 'On Track' : `${Math.abs(paceDelta)}% behind`})
                        </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden relative">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 rounded-full transition-all duration-500"
                            style={{ width: `${stats.progressPct}%` }}
                        />
                        {stats.targetPct > 0 && (
                            <div
                                title={`Weekly Monday Drip Target: ${stats.targetPct}%`}
                                className="absolute top-0 bottom-0 w-0.5 bg-amber-400/90"
                                style={{ left: `${Math.min(100, stats.targetPct)}%` }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Modules Cleared</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-white">
                        {stats.completedModules} <span className="text-sm font-normal text-slate-500">/ {stats.totalModules}</span>
                    </div>
                </div>

                <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Active Streak</span>
                        <Flame className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-white">
                        {stats.streak} <span className="text-sm font-normal text-slate-500">days (best {stats.longestStreak}d)</span>
                    </div>
                </div>

                <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Cohort Week</span>
                        <CalendarClock className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-white">
                        Week {stats.currentWeek} <span className="text-sm font-normal text-slate-500">/ 12</span>
                    </div>
                </div>

                <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Pacing Rule</span>
                        <Target className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white">
                        {cohort.pacing_mode === 'weekly_drip_sequential' ? 'Monday Drip + Sequential' : 'Self-Paced Sequential'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Starts {cohort.start_date}</div>
                </div>
            </div>

            {/* Main 2-column layout: Curriculum Roadmap + Team Takeaways Feed */}
            <div className="grid lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Sequential Curriculum Roadmap</h2>

                    {courses.length === 0 ? (
                        <div className="rounded-xl bg-slate-900 border border-slate-800 p-8 text-center text-slate-400 text-sm">
                            No courses seeded yet. Run <code className="text-indigo-300">npx tsx scripts/ingest-ai-pm-course.ts --seed-db</code> to populate the curriculum.
                        </div>
                    ) : (
                        courses.map((course: any) => {
                            const isOpen = Boolean(openCourses[course.id]);
                            const pct =
                                course.total_lessons > 0
                                    ? Math.round((course.completed_lessons / course.total_lessons) * 100)
                                    : 0;

                            return (
                                <div key={course.id} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                                    <button
                                        onClick={() => setOpenCourses((p) => ({ ...p, [course.id]: !p[course.id] }))}
                                        className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-slate-800/40 transition"
                                    >
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {isOpen ? (
                                                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                                )}
                                                <h3 className="font-semibold text-white truncate">{course.title}</h3>
                                            </div>
                                            <p className="text-xs text-slate-400 pl-6 line-clamp-1">{course.description}</p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-xs font-semibold text-indigo-300">{pct}%</div>
                                            <div className="text-[11px] text-slate-500">
                                                {course.completed_lessons}/{course.total_lessons}
                                            </div>
                                        </div>
                                    </button>

                                    {isOpen && (
                                        <div className="border-t border-slate-800 divide-y divide-slate-800/70">
                                            {course.modules.map((mod: any) => {
                                                const modOpen = Boolean(openModules[mod.id]);
                                                const dripDate = mod.drip_unlocks_at
                                                    ? new Date(mod.drip_unlocks_at).toLocaleDateString('en-US', {
                                                          month: 'short',
                                                          day: 'numeric',
                                                      })
                                                    : '';

                                                return (
                                                    <div key={mod.id} className="bg-slate-950/30">
                                                        <button
                                                            onClick={() => setOpenModules((p) => ({ ...p, [mod.id]: !p[mod.id] }))}
                                                            className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-800/30 transition"
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                {modOpen ? (
                                                                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                                                                ) : (
                                                                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                                                                )}
                                                                <span className="text-sm font-medium text-slate-200 truncate">{mod.title}</span>
                                                                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 shrink-0">
                                                                    Week {mod.target_week}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {!mod.drip_unlocked ? (
                                                                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                                                        <CalendarClock className="w-3 h-3" /> Unlocks {dripDate}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-slate-400">
                                                                        {mod.completed_lessons}/{mod.total_lessons} done
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </button>

                                                        {modOpen && (
                                                            <div className="px-5 pb-4 pt-1 space-y-1.5">
                                                                {mod.lessons.map((lesson: any) => {
                                                                    const isLocked =
                                                                        lesson.access_state === 'locked_prereq' ||
                                                                        lesson.access_state === 'locked_drip';
                                                                    const isDone = lesson.access_state === 'completed';

                                                                    const rowInner = (
                                                                        <div
                                                                            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-sm transition ${
                                                                                isLocked
                                                                                    ? 'bg-slate-900/40 border-slate-800/50 text-slate-500 cursor-not-allowed'
                                                                                    : isDone
                                                                                      ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-200 hover:bg-emerald-500/10'
                                                                                      : 'bg-indigo-500/10 border-indigo-500/30 text-white hover:bg-indigo-500/15'
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-center gap-3 min-w-0">
                                                                                {isDone ? (
                                                                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                                                                ) : isLocked ? (
                                                                                    <Lock className="w-4 h-4 text-slate-600 shrink-0" />
                                                                                ) : (
                                                                                    <LessonTypeIcon type={lesson.lesson_type} />
                                                                                )}
                                                                                <span className="truncate">{lesson.title}</span>
                                                                            </div>

                                                                            <div className="flex items-center gap-2 shrink-0 text-[11px]">
                                                                                {lesson.project_review_status && (
                                                                                    <span
                                                                                        className={`px-2 py-0.5 rounded-full capitalize ${
                                                                                            lesson.project_review_status === 'approved'
                                                                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                                                                : lesson.project_review_status === 'revision_requested'
                                                                                                  ? 'bg-amber-500/20 text-amber-300'
                                                                                                  : 'bg-sky-500/20 text-sky-300'
                                                                                        }`}
                                                                                    >
                                                                                        {lesson.project_review_status.replace('_', ' ')}
                                                                                    </span>
                                                                                )}
                                                                                <span className="text-slate-500">{lesson.estimated_minutes}m</span>
                                                                            </div>
                                                                        </div>
                                                                    );

                                                                    return isLocked ? (
                                                                        <div key={lesson.id}>{rowInner}</div>
                                                                    ) : (
                                                                        <Link key={lesson.id} to={`/lesson/${lesson.id}`} className="block">
                                                                            {rowInner}
                                                                        </Link>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Right Column: Team Key Takeaways Activity Feed */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <MessageSquareQuote className="w-4 h-4 text-indigo-400" />
                        <h2 className="text-lg font-semibold text-white">Cohort Takeaways Feed</h2>
                    </div>

                    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
                        {teamFeed.length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">
                                As your team completes readings and projects, their 1-sentence key takeaways appear here to keep everyone inspired.
                            </p>
                        ) : (
                            teamFeed.map((item: any, idx: number) => (
                                <div key={idx} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-semibold text-indigo-300">{item.learnerName}</span>
                                        <span className="text-slate-500">
                                            {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 truncate">{item.lessonTitle}</div>
                                    <p className="text-xs text-slate-200 leading-relaxed">“{item.takeaway}”</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
