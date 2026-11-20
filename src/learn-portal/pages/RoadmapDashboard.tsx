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
    Target,
    Users,
} from 'lucide-react';
import { learnApi } from '../lib/api';
import { CourseraLogo, MicrosoftLogo } from '../components/BrandLogos';

function LessonTypeIcon({ type }: { type: string }) {
    switch (type) {
        case 'video':
            return <PlayCircle className="w-4 h-4 text-neutral-900 shrink-0" />;
        case 'quiz':
            return <FileQuestion className="w-4 h-4 text-amber-600 shrink-0" />;
        case 'project':
            return <FolderKanban className="w-4 h-4 text-emerald-700 shrink-0" />;
        default:
            return <BookOpen className="w-4 h-4 text-neutral-600 shrink-0" />;
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
            <div className="py-20 flex items-center justify-center gap-3 text-neutral-500">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-950" />
                <span className="text-xs uppercase tracking-[0.2em]">Loading cohort roadmap...</span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-red-50 border border-red-200 p-6 text-red-700 text-sm">
                {error || 'Unable to load roadmap. Have you seeded the course curriculum yet?'}
            </div>
        );
    }

    const { stats, nextUpLesson, courses, teamFeed, cohort, studyPartner } = data;
    const paceDelta = stats.progressPct - stats.targetPct;

    return (
        <div className="space-y-6 sm:space-y-8">
            {/* Clean Editorial Hero Card */}
            <div className="bg-[#030213] text-white p-6 sm:p-8 border border-neutral-900">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2.5 max-w-2xl">
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                            {nextUpLesson
                                ? `Up Next · Week ${stats.currentWeek} of ${stats.totalWeeks || 12}`
                                : `Week ${stats.currentWeek} of ${stats.totalWeeks || 12}`}
                        </div>
                        <h1 className="text-xl sm:text-3xl font-semibold tracking-tight text-white leading-snug">
                            {nextUpLesson ? nextUpLesson.title : "You're Caught Up for This Week!"}
                        </h1>
                        <p className="text-sm text-neutral-400">
                            {nextUpLesson
                                ? `${nextUpLesson.module_title} · ${nextUpLesson.estimated_minutes} min`
                                : 'New lessons unlock every Monday at 7:00 AM WAT.'}
                        </p>
                    </div>

                    {nextUpLesson && (
                        <Link
                            to={`/lesson/${nextUpLesson.id}`}
                            className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-neutral-100 text-[#030213] text-xs font-bold uppercase tracking-[0.2em] transition"
                        >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Continue Learning
                        </Link>
                    )}
                </div>

                {/* Minimal Progress Footer */}
                <div className="mt-6 pt-5 border-t border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-neutral-300">
                            <strong className="text-white">{stats.progressPct}%</strong> complete
                            <span className="text-neutral-500 ml-1.5">
                                ({stats.completedLessons}/{stats.totalLessons})
                            </span>
                        </span>
                        <span className={paceDelta >= 0 ? 'text-emerald-400 font-medium' : 'text-amber-300 font-medium'}>
                            {paceDelta >= 0 ? 'On Track' : `Goal: ${stats.targetPct}%`}
                        </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/15 overflow-hidden relative">
                        <div
                            className="h-full bg-white transition-all duration-500"
                            style={{ width: `${stats.progressPct}%` }}
                        />
                        {stats.targetPct > 0 && (
                            <div
                                title={`This Week's Goal: ${stats.targetPct}%`}
                                className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
                                style={{ left: `${Math.min(100, stats.targetPct)}%` }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white border border-neutral-200 p-3.5 sm:p-4">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                        <span>Modules Done</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    </div>
                    <div className="mt-2 text-xl sm:text-2xl font-semibold text-neutral-950">
                        {stats.completedModules} <span className="text-xs sm:text-sm font-normal text-neutral-400">/ {stats.totalModules}</span>
                    </div>
                </div>

                <div className="bg-white border border-neutral-200 p-3.5 sm:p-4">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                        <span>Study Streak</span>
                        <Flame className="w-4 h-4 text-amber-600 shrink-0" />
                    </div>
                    <div className="mt-2 text-xl sm:text-2xl font-semibold text-neutral-950">
                        {stats.streak} <span className="text-xs sm:text-sm font-normal text-neutral-400">days</span>
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">Best: {stats.longestStreak}d</div>
                </div>

                <div className="bg-white border border-neutral-200 p-3.5 sm:p-4">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                        <span>Current Week</span>
                        <CalendarClock className="w-4 h-4 text-neutral-700 shrink-0" />
                    </div>
                    <div className="mt-2 text-xl sm:text-2xl font-semibold text-neutral-950">
                        Week {stats.currentWeek}{' '}
                        <span className="text-xs sm:text-sm font-normal text-neutral-400">/ {stats.totalWeeks || 12}</span>
                    </div>
                </div>

                <div className="bg-white border border-neutral-200 p-3.5 sm:p-4">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                        <span>Course Schedule</span>
                        <Target className="w-4 h-4 text-neutral-700 shrink-0" />
                    </div>
                    <div className="mt-2 text-xs sm:text-sm font-semibold text-neutral-950">
                        {cohort.pacing_mode === 'weekly_drip_sequential' ? 'Weekly Unlocks (Mondays)' : 'Self-Paced'}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">Starts {cohort.start_date}</div>
                </div>
            </div>

            {/* Main 2-column layout: Course Lessons + Team Notes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 min-w-0 w-full space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-900">
                            Course Lessons
                        </h2>
                        <div className="inline-flex items-center gap-2 text-xs text-neutral-500 shrink-0">
                            <MicrosoftLogo className="h-3.5" />
                            <span>×</span>
                            <CourseraLogo />
                        </div>
                    </div>

                    {courses.length === 0 ? (
                        <div className="bg-white border border-neutral-200 p-8 text-left text-neutral-500 text-sm">
                            No courses seeded yet. Run <code className="text-neutral-900 font-semibold">npx tsx scripts/ingest-ai-pm-course.ts --seed-db</code> to populate the curriculum.
                        </div>
                    ) : (
                        courses.map((course: any) => {
                            const isOpen = Boolean(openCourses[course.id]);
                            const pct =
                                course.total_lessons > 0
                                    ? Math.round((course.completed_lessons / course.total_lessons) * 100)
                                    : 0;

                            return (
                                <div key={course.id} className="bg-white border border-neutral-200 overflow-hidden w-full">
                                    <button
                                        onClick={() => setOpenCourses((p) => ({ ...p, [course.id]: !p[course.id] }))}
                                        className="w-full p-4 sm:p-5 flex items-start sm:items-center justify-between gap-3 text-left hover:bg-neutral-50 transition"
                                    >
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex items-start sm:items-center gap-2">
                                                {isOpen ? (
                                                    <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5 sm:mt-0" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5 sm:mt-0" />
                                                )}
                                                <h3 className="font-semibold text-sm sm:text-base text-neutral-950 break-words leading-snug">
                                                    {course.title}
                                                </h3>
                                            </div>
                                            <p className="text-xs text-neutral-500 pl-6 line-clamp-2">{course.description}</p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-xs font-bold text-neutral-950">{pct}%</div>
                                            <div className="text-[11px] text-neutral-500">
                                                {course.completed_lessons}/{course.total_lessons}
                                            </div>
                                        </div>
                                    </button>

                                    {isOpen && (
                                        <div className="border-t border-neutral-200 divide-y divide-neutral-200/80">
                                            {course.modules.map((mod: any) => {
                                                const modOpen = Boolean(openModules[mod.id]);
                                                const dripDate = mod.drip_unlocks_at
                                                    ? new Date(mod.drip_unlocks_at).toLocaleDateString('en-US', {
                                                          month: 'short',
                                                          day: 'numeric',
                                                      })
                                                    : '';

                                                return (
                                                    <div key={mod.id} className="bg-neutral-50/40">
                                                        <button
                                                            onClick={() => setOpenModules((p) => ({ ...p, [mod.id]: !p[mod.id] }))}
                                                            className="w-full px-4 sm:px-5 py-3.5 flex items-start sm:items-center justify-between gap-2 text-left hover:bg-neutral-100/70 transition"
                                                        >
                                                            <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1 flex-wrap">
                                                                {modOpen ? (
                                                                    <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5 sm:mt-0" />
                                                                ) : (
                                                                    <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5 sm:mt-0" />
                                                                )}
                                                                <span className="text-sm font-medium text-neutral-900 break-words leading-snug">
                                                                    {mod.title}
                                                                </span>
                                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-neutral-200/80 text-neutral-700 shrink-0">
                                                                    Week {mod.target_week}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {!mod.drip_unlocked ? (
                                                                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                                                                        <CalendarClock className="w-3 h-3" /> {dripDate}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-neutral-500 whitespace-nowrap">
                                                                        {mod.completed_lessons}/{mod.total_lessons} done
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </button>

                                                        {modOpen && (
                                                            <div className="px-3.5 sm:px-5 pb-4 pt-1 space-y-1.5 bg-white">
                                                                {mod.lessons.map((lesson: any) => {
                                                                    const isLocked =
                                                                        lesson.access_state === 'locked_prereq' ||
                                                                        lesson.access_state === 'locked_drip';
                                                                    const isDone = lesson.access_state === 'completed';

                                                                    const rowInner = (
                                                                        <div
                                                                            className={`flex items-start sm:items-center justify-between gap-2.5 px-3 sm:px-3.5 py-2.5 border text-sm transition ${
                                                                                isLocked
                                                                                    ? 'bg-neutral-50 border-neutral-200/70 text-neutral-400 cursor-not-allowed'
                                                                                    : isDone
                                                                                      ? 'bg-emerald-50/50 border-emerald-200 text-neutral-800 hover:bg-emerald-50'
                                                                                      : 'bg-white border-neutral-300 text-neutral-950 font-medium hover:border-neutral-950'
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                                                                                <span className="mt-0.5 sm:mt-0 shrink-0">
                                                                                    {isDone ? (
                                                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                                                    ) : isLocked ? (
                                                                                        <Lock className="w-4 h-4 text-neutral-400" />
                                                                                    ) : (
                                                                                        <LessonTypeIcon type={lesson.lesson_type} />
                                                                                    )}
                                                                                </span>
                                                                                <span className="break-words leading-snug text-xs sm:text-sm">
                                                                                    {lesson.title}
                                                                                </span>
                                                                            </div>

                                                                            <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                                                                                {lesson.project_review_status && (
                                                                                    <span
                                                                                        className={`px-2 py-0.5 capitalize font-semibold ${
                                                                                            lesson.project_review_status === 'approved'
                                                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                                                : lesson.project_review_status === 'revision_requested'
                                                                                                  ? 'bg-amber-100 text-amber-800'
                                                                                                  : 'bg-neutral-200 text-neutral-800'
                                                                                        }`}
                                                                                    >
                                                                                        {lesson.project_review_status.replace('_', ' ')}
                                                                                    </span>
                                                                                )}
                                                                                <span className="text-neutral-400">{lesson.estimated_minutes}m</span>
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

                {/* Right Column: Study Partner + Team Notes Feed */}
                <div className="min-w-0 w-full space-y-6">
                    {studyPartner && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-neutral-900" />
                                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-900">
                                    Study Partner
                                </h2>
                            </div>

                            <div className="bg-white border border-neutral-200 p-4 space-y-3 text-left">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-neutral-950 truncate">
                                            {studyPartner.fullName}
                                        </div>
                                        {studyPartner.jobRole && (
                                            <div className="text-[11px] text-neutral-500 truncate">
                                                {studyPartner.jobRole}
                                            </div>
                                        )}
                                    </div>
                                    <span
                                        title="Partner's daily study streak"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-900 text-xs font-semibold shrink-0"
                                    >
                                        <Flame className="w-3 h-3 text-amber-600" />
                                        {studyPartner.streak}d
                                    </span>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-neutral-950">
                                            {studyPartner.progressPct}% complete
                                        </span>
                                        <span className="text-neutral-500">
                                            {studyPartner.completedLessons}/{studyPartner.totalLessons} lessons
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-neutral-200 overflow-hidden">
                                        <div
                                            className="h-full bg-[#030213] transition-all duration-500"
                                            style={{ width: `${studyPartner.progressPct}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-100">
                                    <span>Currently on Week {studyPartner.currentWeek}</span>
                                    <span>
                                        {studyPartner.lastActiveAt
                                            ? `Active ${new Date(studyPartner.lastActiveAt).toLocaleDateString()}`
                                            : 'Not started yet'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <MessageSquareQuote className="w-4 h-4 text-neutral-900" />
                            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-900">
                                Team Notes
                            </h2>
                        </div>

                        <div className="bg-white border border-neutral-200 p-4 space-y-3">
                            {teamFeed.length === 0 ? (
                                <p className="text-xs text-neutral-500 py-2 text-left leading-relaxed">
                                    Short notes teammates write after finishing a reading or project show up here.
                                </p>
                            ) : (
                                teamFeed.map((item: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-neutral-50 border border-neutral-200 space-y-1.5 text-left">
                                        <div className="flex items-center justify-between gap-2 text-[11px]">
                                            <span className="font-semibold text-neutral-950 truncate">{item.learnerName}</span>
                                            <span className="text-neutral-400 shrink-0">
                                                {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : ''}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-neutral-500 break-words">{item.lessonTitle}</div>
                                        <p className="text-xs text-neutral-700 leading-relaxed break-words">“{item.takeaway}”</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
