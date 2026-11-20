/**
 * Microsoft AI Product Manager — Course Ingestion & Video Slicer Pipeline
 *
 * Usage:
 *   npx tsx scripts/ingest-ai-pm-course.ts --dry-run
 *   npx tsx scripts/ingest-ai-pm-course.ts --slice-videos
 *   npx tsx scripts/ingest-ai-pm-course.ts --upload-r2
 *   npx tsx scripts/ingest-ai-pm-course.ts --seed-db
 *   npx tsx scripts/ingest-ai-pm-course.ts --all
 *
 * Prerequisites in .env:
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import mammoth from 'mammoth';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const ROOT_DIR = path.resolve(process.cwd(), 'Microsoft AI Product Manager-All Assignments, Reading and Resources');
const SLICED_DIR = path.resolve(process.cwd(), 'tmp/lms-videos');
const PREVIEW_FILE = path.resolve(process.cwd(), 'tmp/lms-manifest-preview.json');
const QUIZ_KEYS_FILE = path.resolve(process.cwd(), 'scripts/quiz-answer-keys.json');

const args = new Set(process.argv.slice(2));
const RUN_ALL = args.has('--all');
const DRY_RUN = args.has('--dry-run') || (!RUN_ALL && !args.has('--slice-videos') && !args.has('--upload-r2') && !args.has('--seed-db'));
const DO_SLICE = RUN_ALL || args.has('--slice-videos');
const DO_UPLOAD_R2 = RUN_ALL || args.has('--upload-r2');
const DO_SEED_DB = RUN_ALL || args.has('--seed-db');

// 12-week Monday drip schedule mapping: key = "<courseOrder>-<moduleOrder>" -> targetWeek (1..12)
const TARGET_WEEK_MAP: Record<string, number> = {
    '0-1': 1, // Course Intro
    '1-1': 1, '1-2': 1,
    '1-3': 2, '1-4': 2, '1-5': 2,
    '2-1': 3, '2-2': 3,
    '2-3': 4, '2-4': 4,
    '3-1': 5, '3-2': 5, '3-3': 5,
    '3-4': 6, '3-5': 6, '3-6': 6,
    '4-1': 7, '4-2': 7,
    '4-3': 8, '4-4': 8,
    '4-5': 9,
    '5-1': 10, '5-2': 10, '5-3': 10,
    '5-4': 11, '5-5': 11,
    '5-6': 12, '5-7': 12,
};

const COURSE_METADATA: Record<number, { slug: string; title: string; description: string }> = {
    0: {
        slug: 'course-0-program-introduction',
        title: 'Program Orientation',
        description: 'Start here: a quick 3-minute orientation to the Microsoft AI Product Manager Professional Certificate and how our 12-week cohort works.',
    },
    1: {
        slug: 'course-1-enterprise-pm-fundamentals',
        title: 'Course 1: Enterprise Product Management Fundamentals',
        description: 'Core PM competencies, market research basics, product development lifecycle, product vision & strategy, and enterprise roadmapping.',
    },
    2: {
        slug: 'course-2-market-research-competitive-analysis',
        title: 'Course 2: Market Research and Competitive Analysis',
        description: 'Market research toolkits, buyer psychology, segmentation & personas, competitive intelligence, SWOT, JTBD, and AI market dynamics.',
    },
    3: {
        slug: 'course-3-product-strategy-roadmapping',
        title: 'Course 3: Product Strategy and Roadmapping',
        description: 'Ideation with Copilot, SMART objectives, Power BI KPI tracking, Microsoft Project roadmaps, requirements & QA, AI product development, and stakeholder alignment.',
    },
    4: {
        slug: 'course-4-product-design-ux-ui-fundamentals',
        title: 'Course 4: Product Design and UX/UI Fundamentals',
        description: 'Design fundamentals, accessibility, heuristic evaluation, wireframing & mockups in Figma, usability testing, and ethical human-AI design.',
    },
    5: {
        slug: 'course-5-product-launch-post-launch-management',
        title: 'Course 5: Product Launch and Post-Launch Management',
        description: 'Launch timelines, B2B marketing & sales enablement, enterprise QA & risk registers, post-launch KPI monitoring, AI-powered PM workflows, and AI lifecycle management.',
    },
};

function slugify(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 72);
}

function parseLeadingNumber(name: string): number {
    const match = name.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 999;
}

function cleanFileTitle(filename: string): string {
    return filename
        .replace(/\.docx$/i, '')
        .replace(/^\d+[\s._-]*/, '')
        .replace(/asigmnent|assig\b|assignmen\b/gi, 'Assignment')
        .replace(/deploymen\b/gi, 'deployment')
        .replace(/_/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function parseTimestampToSeconds(ts: string): number {
    const parts = ts.trim().split(':').map((p) => parseInt(p, 10));
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
}

function getVideoDurationSeconds(videoPath: string): number {
    try {
        const out = execFileSync('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            videoPath,
        ]).toString().trim();
        return Math.round(parseFloat(out) || 0);
    } catch {
        return 0;
    }
}

interface ParsedChapter {
    title: string;
    startSeconds: number; // relative to module video start
    absoluteTimestamp: string;
}

interface ParsedWeekVideo {
    weekNum: number;
    title: string;
    startSeconds: number;
    endSeconds: number;
    chapters: ParsedChapter[];
}

function parseTimestampsTxt(txtPath: string, totalVideoSeconds: number): Map<number, ParsedWeekVideo> {
    const raw = fs.readFileSync(txtPath, 'utf8');
    const lines = raw.split(/\r?\n/);

    const weeks: Array<{ weekNum: number; title: string; entries: Array<{ absSec: number; ts: string; title: string }> }> = [];
    let current: { weekNum: number; title: string; entries: Array<{ absSec: number; ts: string; title: string }> } | null = null;

    for (const line of lines) {
        const trimmed = line.trim();
        const weekMatch = trimmed.match(/^Week\s+(\d+)\s*:\s*(.+)$/i);
        const sumMatch = trimmed.match(/^Course\s+Summary/i);
        const tsMatch = trimmed.match(/^(\d+:\d+(?::\d+)?)\s*-\s*(.+)$/);

        if (weekMatch) {
            current = {
                weekNum: parseInt(weekMatch[1], 10),
                title: weekMatch[2].replace(/\*+$/g, '').trim(),
                entries: [],
            };
            weeks.push(current);
        } else if (sumMatch) {
            current = { weekNum: 99, title: 'Course Summary', entries: [] };
            weeks.push(current);
        } else if (tsMatch && current) {
            current.entries.push({
                absSec: parseTimestampToSeconds(tsMatch[1]),
                ts: tsMatch[1],
                title: tsMatch[2].trim(),
            });
        }
    }

    const result = new Map<number, ParsedWeekVideo>();
    for (let i = 0; i < weeks.length; i++) {
        const w = weeks[i];
        if (w.weekNum === 99 || w.entries.length === 0) continue;
        const startSec = w.entries[0].absSec;
        let endSec = totalVideoSeconds;
        for (let j = i + 1; j < weeks.length; j++) {
            if (weeks[j].entries.length > 0) {
                endSec = weeks[j].entries[0].absSec;
                break;
            }
        }
        if (endSec <= startSec) endSec = totalVideoSeconds;
        result.set(w.weekNum, {
            weekNum: w.weekNum,
            title: w.title,
            startSeconds: startSec,
            endSeconds: endSec,
            chapters: w.entries.map((e) => ({
                title: e.title,
                startSeconds: Math.max(0, e.absSec - startSec),
                absoluteTimestamp: e.ts,
            })),
        });
    }
    return result;
}

interface ParsedQuizQuestion {
    id: string;
    prompt: string;
    type: 'single' | 'multi';
    options: string[];
    correct_indices: number[];
    explanation: string;
}

function parseQuizFromText(rawText: string): { title: string; questions: ParsedQuizQuestion[] } {
    const lines = rawText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    const quizTitle = lines[0] || 'Practice Assignment';
    const questions: ParsedQuizQuestion[] = [];

    // Locate "Question N" markers
    const qIndices: number[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (/^Question\s+\d+$/i.test(lines[i])) {
            qIndices.push(i);
        }
    }

    for (let qi = 0; qi < qIndices.length; qi++) {
        const start = qIndices[qi] + 1;
        const end = qi + 1 < qIndices.length ? qIndices[qi + 1] : lines.length;
        const block = lines
            .slice(start, end)
            .filter((l) => !/^\d+\s*point/i.test(l) && !/^\d+\.$/.test(l));

        if (block.length < 3) continue;

        // Find the line containing the question stem ("Choose the best answer" / "Select all that apply" / ends with "?")
        let stemEndIdx = 0;
        for (let i = 0; i < block.length; i++) {
            if (/\?|Choose the|Select all|Select the|Which of the/i.test(block[i])) {
                stemEndIdx = i;
            }
        }
        // Ensure at least 2 options remain after stem
        if (block.length - (stemEndIdx + 1) < 2) {
            stemEndIdx = Math.max(0, block.length - 5);
        }

        const prompt = block.slice(0, stemEndIdx + 1).join(' ');
        const options = block.slice(stemEndIdx + 1);
        const isMulti = /select all that apply|select two|select three|choose all/i.test(prompt);

        questions.push({
            id: `q${qi + 1}`,
            prompt,
            type: isMulti ? 'multi' : 'single',
            options,
            correct_indices: [], // Admin verifies & locks via /admin -> Quiz Answer Keys
            explanation: '',
        });
    }

    return { title: quizTitle, questions };
}

interface ManifestLesson {
    slug: string;
    orderIndex: number;
    globalOrder: number;
    lessonType: 'video' | 'reading' | 'quiz' | 'project';
    title: string;
    sourcePath: string;
    estimatedMinutes: number;
    // video
    sourceVideoAbsPath?: string;
    sliceStartSec?: number;
    sliceEndSec?: number;
    localSlicedPath?: string;
    videoR2Key?: string;
    durationSeconds?: number;
    chapters?: ParsedChapter[];
    // reading
    contentHtml?: string;
    wordCount?: number;
    minDwellSeconds?: number;
    // quiz
    quizQuestions?: ParsedQuizQuestion[];
    // project
    projectBrief?: string;
    projectAssets?: Array<{ name: string; localPath: string; storagePath: string; type: string; isExemplar: boolean }>;
}

interface ManifestModule {
    slug: string;
    courseOrder: number;
    orderIndex: number;
    globalOrder: number;
    title: string;
    targetWeek: number;
    estimatedMinutes: number;
    sourceFolder: string;
    lessons: ManifestLesson[];
}

interface ManifestCourse {
    orderIndex: number;
    slug: string;
    title: string;
    description: string;
    totalVideoSeconds: number;
    sourceFolder: string;
    modules: ManifestModule[];
}

async function buildManifest(): Promise<ManifestCourse[]> {
    if (!fs.existsSync(ROOT_DIR)) {
        throw new Error(`Course folder not found at: ${ROOT_DIR}`);
    }

    const courses: ManifestCourse[] = [];
    let globalModuleOrder = 0;
    let globalLessonOrder = 0;

    // 0. Program Introduction Video (Course 0, Module 1)
    const introMp4 = path.join(ROOT_DIR, 'Course Introduction.mp4');
    if (fs.existsSync(introMp4)) {
        const introDur = getVideoDurationSeconds(introMp4) || 197;
        globalModuleOrder += 1;
        globalLessonOrder += 1;
        courses.push({
            orderIndex: 0,
            ...COURSE_METADATA[0],
            totalVideoSeconds: introDur,
            sourceFolder: '.',
            modules: [
                {
                    slug: 'c0-m1-program-orientation',
                    courseOrder: 0,
                    orderIndex: 1,
                    globalOrder: globalModuleOrder,
                    title: 'Welcome & Cohort Orientation',
                    targetWeek: 1,
                    estimatedMinutes: 5,
                    sourceFolder: '.',
                    lessons: [
                        {
                            slug: 'c0-m1-l1-course-introduction',
                            orderIndex: 1,
                            globalOrder: globalLessonOrder,
                            lessonType: 'video',
                            title: 'Microsoft AI Product Manager — Program Introduction',
                            sourcePath: 'Course Introduction.mp4',
                            estimatedMinutes: 4,
                            sourceVideoAbsPath: introMp4,
                            sliceStartSec: 0,
                            sliceEndSec: introDur,
                            localSlicedPath: path.join(SLICED_DIR, 'course-0-intro.mp4'),
                            videoR2Key: 'videos/course-0-intro.mp4',
                            durationSeconds: introDur,
                            chapters: [{ title: 'Program Overview', startSeconds: 0, absoluteTimestamp: '0:00:00' }],
                        },
                    ],
                },
            ],
        });
    }

    // 1..5 Courses
    const courseDirs = fs
        .readdirSync(ROOT_DIR)
        .filter((d) => fs.statSync(path.join(ROOT_DIR, d)).isDirectory() && d.startsWith('All Reading-'))
        .sort((a, b) => parseLeadingNumber(a) - parseLeadingNumber(b));

    for (const cDir of courseDirs) {
        const cNum = parseLeadingNumber(cDir);
        const cAbs = path.join(ROOT_DIR, cDir);
        const filesInCourse = fs.readdirSync(cAbs);

        const mp4File = filesInCourse.find((f) => f.toLowerCase().endsWith('.mp4'));
        const txtFile = filesInCourse.find((f) => f.toLowerCase().endsWith('.txt'));
        const mp4Abs = mp4File ? path.join(cAbs, mp4File) : '';
        const totalVideoSec = mp4Abs ? getVideoDurationSeconds(mp4Abs) : 0;
        const weekVideos = txtFile ? parseTimestampsTxt(path.join(cAbs, txtFile), totalVideoSec) : new Map();

        const meta = COURSE_METADATA[cNum] || {
            slug: `course-${cNum}-${slugify(cDir)}`,
            title: `Course ${cNum}: ${cDir}`,
            description: '',
        };

        const modDirs = filesInCourse
            .filter((item) => item !== '.DS_Store' && fs.statSync(path.join(cAbs, item)).isDirectory())
            .sort((a, b) => parseLeadingNumber(a) - parseLeadingNumber(b));

        const manifestModules: ManifestModule[] = [];

        for (const mDir of modDirs) {
            const mNum = parseLeadingNumber(mDir);
            const mAbs = path.join(cAbs, mDir);
            globalModuleOrder += 1;

            const wv = weekVideos.get(mNum);
            const modTitle = wv?.title ? `Module ${mNum}: ${wv.title}` : `Module ${mNum}`;
            const targetWeek = TARGET_WEEK_MAP[`${cNum}-${mNum}`] || 12;
            const modSlug = `c${cNum}-m${mNum}-${slugify(wv?.title || mDir)}`;

            const lessons: ManifestLesson[] = [];
            let modLessonOrder = 0;

            // Lesson 1 of every module: Module Video (sliced from monolithic Course MP4)
            if (mp4Abs && wv) {
                modLessonOrder += 1;
                globalLessonOrder += 1;
                const dur = Math.max(60, wv.endSeconds - wv.startSeconds);
                const r2Filename = `course-${cNum}-module-${String(mNum).padStart(2, '0')}.mp4`;
                lessons.push({
                    slug: `${modSlug}-video`,
                    orderIndex: modLessonOrder,
                    globalOrder: globalLessonOrder,
                    lessonType: 'video',
                    title: `Video Lectures — ${wv.title}`,
                    sourcePath: path.relative(ROOT_DIR, mp4Abs),
                    estimatedMinutes: Math.max(5, Math.round(dur / 60)),
                    sourceVideoAbsPath: mp4Abs,
                    sliceStartSec: wv.startSeconds,
                    sliceEndSec: wv.endSeconds,
                    localSlicedPath: path.join(SLICED_DIR, r2Filename),
                    videoR2Key: `videos/${r2Filename}`,
                    durationSeconds: dur,
                    chapters: wv.chapters,
                });
            }

            // Read all .docx files and subdirectories in natural numeric order
            const entries = fs.readdirSync(mAbs).filter((e) => e !== '.DS_Store');
            const docFiles = entries
                .filter((e) => !fs.statSync(path.join(mAbs, e)).isDirectory() && e.toLowerCase().endsWith('.docx'))
                .sort((a, b) => {
                    const na = parseLeadingNumber(a);
                    const nb = parseLeadingNumber(b);
                    return na !== nb ? na - nb : a.localeCompare(b);
                });
            const subDirs = entries
                .filter((e) => fs.statSync(path.join(mAbs, e)).isDirectory())
                .sort();

            // Collect any project-activity instruction briefs so we can merge them into matching project deliverables
            const pendingActivityBriefs: Array<{ title: string; briefText: string; relPath: string }> = [];

            for (const docFile of docFiles) {
                const docAbs = path.join(mAbs, docFile);
                const relPath = path.relative(ROOT_DIR, docAbs);
                const rawTextRes = await mammoth.extractRawText({ path: docAbs });
                const rawText = rawTextRes.value || '';

                const looksLikePracticeFile =
                    /practice\s*ass?ig/i.test(docFile) ||
                    /Practice Assignment\s*[•·-]\s*\d+\s*min/i.test(rawText);

                const isStandaloneTemplate =
                    !looksLikePracticeFile && /(^Product Strategy Template|^Project file\s)/i.test(docFile);

                if (isStandaloneTemplate) {
                    modLessonOrder += 1;
                    globalLessonOrder += 1;
                    const cleanTitle = cleanFileTitle(docFile);
                    const storagePath = `projects/${modSlug}/${docFile.replace(/\s+/g, '_')}`;
                    lessons.push({
                        slug: `${modSlug}-l${modLessonOrder}-${slugify(cleanTitle)}`,
                        orderIndex: modLessonOrder,
                        globalOrder: globalLessonOrder,
                        lessonType: 'project',
                        title: `Project: ${cleanTitle}`,
                        sourcePath: relPath,
                        estimatedMinutes: 60,
                        projectBrief: rawText.slice(0, 2800),
                        projectAssets: [
                            {
                                name: docFile,
                                localPath: docAbs,
                                storagePath,
                                type: path.extname(docFile).replace('.', ''),
                                isExemplar: /exemplar/i.test(docFile),
                            },
                        ],
                    });
                } else if (looksLikePracticeFile) {
                    const parsed = parseQuizFromText(rawText);
                    const maxOpts = parsed.questions.reduce((mx, q) => Math.max(mx, q.options.length), 0);
                    const isProjectActivity =
                        /^Activity:/i.test(parsed.title) ||
                        /Project Scenario|Download the zip/i.test(rawText.slice(0, 800)) ||
                        maxOpts > 6;

                    if (parsed.questions.length === 0) {
                        // Misnamed pure reading (e.g., C2 M3 "SWOT analysis in action")
                        const htmlRes = await mammoth.convertToHtml({ path: docAbs });
                        const words = rawText.split(/\s+/).filter(Boolean).length;
                        const estMins = Math.max(3, Math.round(words / 200));
                        const minDwell = Math.max(30, Math.min(360, Math.round((words / 250) * 60 * 0.4)));
                        const readingTitle = parsed.title && parsed.title.length > 4 ? parsed.title : cleanFileTitle(docFile);
                        modLessonOrder += 1;
                        globalLessonOrder += 1;
                        lessons.push({
                            slug: `${modSlug}-l${modLessonOrder}-${slugify(readingTitle).slice(0, 45)}`,
                            orderIndex: modLessonOrder,
                            globalOrder: globalLessonOrder,
                            lessonType: 'reading',
                            title: readingTitle,
                            sourcePath: relPath,
                            estimatedMinutes: estMins,
                            contentHtml: htmlRes.value || `<p>${rawText}</p>`,
                            wordCount: words,
                            minDwellSeconds: minDwell,
                        });
                    } else if (isProjectActivity) {
                        // Extract Scenario + Objective + Step-by-Step Instructions (before Question 1)
                        const beforeQ1 = rawText.split(/\n\s*1\.\s*\n\s*Question\s+1\b|\n\s*Question\s+1\b/i)[0] || rawText;
                        pendingActivityBriefs.push({
                            title: parsed.title.replace(/^Activity:\s*/i, '').trim() || cleanFileTitle(docFile),
                            briefText: beforeQ1.trim().slice(0, 3500),
                            relPath,
                        });
                    } else {
                        // Clean pure MCQ / multi-select Coursera quiz!
                        modLessonOrder += 1;
                        globalLessonOrder += 1;
                        const qTitle = parsed.title && parsed.title.length > 4 ? parsed.title : cleanFileTitle(docFile);
                        lessons.push({
                            slug: `${modSlug}-l${modLessonOrder}-quiz-${slugify(qTitle).slice(0, 40)}`,
                            orderIndex: modLessonOrder,
                            globalOrder: globalLessonOrder,
                            lessonType: 'quiz',
                            title: `Practice Quiz: ${qTitle}`,
                            sourcePath: relPath,
                            estimatedMinutes: 15,
                            quizQuestions: parsed.questions,
                        });
                    }
                } else {
                    const htmlRes = await mammoth.convertToHtml({ path: docAbs });
                    const words = rawText.split(/\s+/).filter(Boolean).length;
                    const estMins = Math.max(3, Math.round(words / 200));
                    const minDwell = Math.max(30, Math.min(360, Math.round((words / 250) * 60 * 0.4)));
                    const cleanTitle = cleanFileTitle(docFile);
                    modLessonOrder += 1;
                    globalLessonOrder += 1;
                    lessons.push({
                        slug: `${modSlug}-l${modLessonOrder}-${slugify(cleanTitle).slice(0, 45)}`,
                        orderIndex: modLessonOrder,
                        globalOrder: globalLessonOrder,
                        lessonType: 'reading',
                        title: cleanTitle,
                        sourcePath: relPath,
                        estimatedMinutes: estMins,
                        contentHtml: htmlRes.value || `<p>${rawText}</p>`,
                        wordCount: words,
                        minDwellSeconds: minDwell,
                    });
                }
            }

            // Hands-on Project Asset Subdirectories (always placed at end of module as capstone deliverable)
            for (const sd of subDirs) {
                const sdAbs = path.join(mAbs, sd);
                const assetFiles = fs.readdirSync(sdAbs).filter((f) => f !== '.DS_Store').sort();
                const prettyName = sd
                    .replace(/^_[a-f0-9]+_/i, '')
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase());

                const assets = assetFiles.map((af) => ({
                    name: af,
                    localPath: path.join(sdAbs, af),
                    storagePath: `projects/${modSlug}/${slugify(sd)}/${af.replace(/\s+/g, '_')}`,
                    type: path.extname(af).replace('.', '').toLowerCase(),
                    isExemplar: /exemplar/i.test(af),
                }));

                let briefText = `Download the project templates below, complete your deliverable, and upload your work (or share a Google Docs/Sheets/Figma link) along with your short reflection.`;
                const briefDoc = assetFiles.find((f) => /scenario|project file/i.test(f) && f.endsWith('.docx'));
                if (briefDoc) {
                    const extracted = await mammoth.extractRawText({ path: path.join(sdAbs, briefDoc) });
                    if (extracted.value) {
                        briefText = extracted.value.slice(0, 2600);
                    }
                }

                modLessonOrder += 1;
                globalLessonOrder += 1;
                lessons.push({
                    slug: `${modSlug}-project-${slugify(prettyName).slice(0, 40)}`,
                    orderIndex: modLessonOrder,
                    globalOrder: globalLessonOrder,
                    lessonType: 'project',
                    title: `Project: ${prettyName}`,
                    sourcePath: path.relative(ROOT_DIR, sdAbs),
                    estimatedMinutes: 90,
                    projectBrief: briefText,
                    projectAssets: assets,
                });
            }

            // Merge Activity briefs into matching module Project(s), or create standalone applied Project lessons
            const existingProjects = lessons.filter((l) => l.lessonType === 'project');
            for (const act of pendingActivityBriefs) {
                // Find best matching project in this module (handles C5 M7 with both Dashboard & Interview)
                const match = existingProjects.find((p) => {
                    const pLow = p.title.toLowerCase();
                    const aLow = act.title.toLowerCase();
                    return (
                        (aLow.includes('interview') && pLow.includes('interview')) ||
                        (aLow.includes('dashboard') && pLow.includes('dashboard')) ||
                        (existingProjects.length === 1 && !aLow.includes('transparency audit'))
                    );
                });

                if (match) {
                    // Prepend the rich step-by-step Activity Scenario & Instructions to the Project brief!
                    match.projectBrief = `${act.briefText}\n\n---\n${match.projectBrief || ''}`.slice(0, 4500);
                } else {
                    // Standalone hands-on applied activity (e.g., C2 M4 AI Product Market Analysis, C4 M5 AI Transparency Audit)
                    modLessonOrder += 1;
                    globalLessonOrder += 1;
                    lessons.push({
                        slug: `${modSlug}-activity-${slugify(act.title).slice(0, 40)}`,
                        orderIndex: modLessonOrder,
                        globalOrder: globalLessonOrder,
                        lessonType: 'project',
                        title: `Applied Activity: ${act.title}`,
                        sourcePath: act.relPath,
                        estimatedMinutes: 45,
                        projectBrief: act.briefText,
                        projectAssets: [],
                    });
                }
            }

            const totalModMins = lessons.reduce((acc, l) => acc + l.estimatedMinutes, 0);
            manifestModules.push({
                slug: modSlug,
                courseOrder: cNum,
                orderIndex: mNum,
                globalOrder: globalModuleOrder,
                title: modTitle,
                targetWeek,
                estimatedMinutes: totalModMins,
                sourceFolder: path.relative(ROOT_DIR, mAbs),
                lessons,
            });
        }

        courses.push({
            orderIndex: cNum,
            ...meta,
            totalVideoSeconds: totalVideoSec,
            sourceFolder: cDir,
            modules: manifestModules,
        });
    }

    return courses;
}

function sliceSingleVideo(courseOrder: number, l: ManifestLesson) {
    if (!l.sourceVideoAbsPath || !l.localSlicedPath) return;
    fs.mkdirSync(path.dirname(l.localSlicedPath), { recursive: true });
    console.log(`  [ffmpeg] Slicing ${path.basename(l.localSlicedPath)} (${l.sliceStartSec}s -> ${l.sliceEndSec}s)...`);
    const ffArgs =
        courseOrder === 0
            ? ['-y', '-i', l.sourceVideoAbsPath, '-c', 'copy', '-movflags', '+faststart', l.localSlicedPath]
            : [
                  '-y',
                  '-ss', String(l.sliceStartSec || 0),
                  '-to', String(l.sliceEndSec || 0),
                  '-i', l.sourceVideoAbsPath,
                  '-c', 'copy',
                  '-movflags', '+faststart',
                  l.localSlicedPath,
              ];
    execFileSync('ffmpeg', ffArgs, { stdio: 'ignore' });
}

function sliceVideos(courses: ManifestCourse[]) {
    fs.mkdirSync(SLICED_DIR, { recursive: true });
    let count = 0;
    for (const c of courses) {
        for (const m of c.modules) {
            for (const l of m.lessons) {
                if (l.lessonType !== 'video' || !l.sourceVideoAbsPath || !l.localSlicedPath) continue;
                if (fs.existsSync(l.localSlicedPath) && fs.statSync(l.localSlicedPath).size > 100_000) {
                    console.log(`  [skip existing] ${path.basename(l.localSlicedPath)}`);
                    count += 1;
                    continue;
                }
                sliceSingleVideo(c.orderIndex, l);
                count += 1;
            }
        }
    }
    console.log(`Sliced/verified ${count} video files in ${SLICED_DIR}`);
}

async function uploadVideosToR2(courses: ManifestCourse[], cleanupAfterUpload = true) {
    const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
    const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
    const bucket = (process.env.R2_BUCKET_NAME || 'cortdevs-lms-private').trim();

    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error('Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY in .env');
    }

    if (
        /your_|placeholder/i.test(accountId + accessKeyId + secretAccessKey) ||
        !/^[0-9a-fA-F]{32}$/.test(accountId)
    ) {
        throw new Error(
            'Invalid Cloudflare R2 credentials in .env! Replace the placeholder values (your_cloudflare_account_id_here, etc.) with your real 32-char hex Cloudflare Account ID, 32-char R2 Access Key ID, and 64-char R2 Secret Access Key.',
        );
    }

    const r2 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        forcePathStyle: true,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
        credentials: { accessKeyId, secretAccessKey },
    });

    let uploaded = 0;
    let skipped = 0;

    for (const c of courses) {
        for (const m of c.modules) {
            for (const l of m.lessons) {
                if (l.lessonType !== 'video' || !l.localSlicedPath || !l.videoR2Key) continue;

                // Skip if already in R2 (only treat 404/NotFound as missing; rethrow auth/TLS errors immediately!)
                try {
                    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: l.videoR2Key }));
                    console.log(`  [R2 exists] ${l.videoR2Key}`);
                    skipped += 1;
                    continue;
                } catch (err: any) {
                    const status = err?.$metadata?.httpStatusCode;
                    const name = err?.name || '';
                    if (status !== 404 && name !== 'NotFound' && name !== 'NoSuchKey') {
                        throw err;
                    }
                }

                // Low-disk safe: slice just this single module (~60-250 MB) right before uploading
                let createdTempSlice = false;
                if (!fs.existsSync(l.localSlicedPath) || fs.statSync(l.localSlicedPath).size < 100_000) {
                    sliceSingleVideo(c.orderIndex, l);
                    createdTempSlice = true;
                }

                const fileSize = fs.statSync(l.localSlicedPath).size;
                const sizeMb = (fileSize / (1024 * 1024)).toFixed(1);
                console.log(`  [R2 upload] ${l.videoR2Key} (${sizeMb} MB)...`);
                const stream = fs.createReadStream(l.localSlicedPath);
                await r2.send(
                    new PutObjectCommand({
                        Bucket: bucket,
                        Key: l.videoR2Key,
                        Body: stream,
                        ContentLength: fileSize,
                        ContentType: 'video/mp4',
                    }),
                );
                uploaded += 1;

                // Immediately delete temp slice so disk usage stays under ~250 MB peak!
                if (cleanupAfterUpload && createdTempSlice && fs.existsSync(l.localSlicedPath)) {
                    fs.unlinkSync(l.localSlicedPath);
                }
            }
        }
    }
    console.log(`R2 Upload complete: ${uploaded} uploaded, ${skipped} already present.`);
}

async function seedDatabaseAndAssets(courses: ManifestCourse[]) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Ensure private storage bucket 'lms-assets' exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.name === 'lms-assets')) {
        console.log('Creating private Supabase Storage bucket: lms-assets...');
        await supabase.storage.createBucket('lms-assets', { public: false });
    }

    // Load preset verified quiz answer keys if scripts/quiz-answer-keys.json exists
    const presetQuizKeys: Record<string, Record<string, { correct_indices: number[]; explanation?: string }>> =
        fs.existsSync(QUIZ_KEYS_FILE) ? JSON.parse(fs.readFileSync(QUIZ_KEYS_FILE, 'utf8')) : {};

    // Collect valid lesson slugs up front, delete obsolete merged slugs FIRST, and
    // temporarily offset shifted global_order/order_index to prevent UNIQUE collisions
    // while preserving all existing lesson UUIDs (zero learner progress lost!).
    const validLessonSlugs = new Set<string>();
    for (const c of courses) {
        for (const m of c.modules) {
            for (const l of m.lessons) validLessonSlugs.add(l.slug);
        }
    }

    const { data: existingLessons } = await supabase.from('lms_lessons').select('id, slug, global_order, order_index');
    const staleIds = (existingLessons || []).filter((r) => !validLessonSlugs.has(r.slug)).map((r) => r.id);
    if (staleIds.length > 0) {
        await supabase.from('lms_lessons').delete().in('id', staleIds);
        console.log(`Removed ${staleIds.length} obsolete/merged lesson rows before re-seeding.`);
    }
    if ((existingLessons || []).length > 0) {
        const remaining = (existingLessons || []).filter((r) => validLessonSlugs.has(r.slug));
        for (let idx = 0; idx < remaining.length; idx++) {
            await supabase
                .from('lms_lessons')
                .update({ global_order: 100000 + idx, order_index: 10000 + idx })
                .eq('id', remaining[idx].id);
        }
    }

    let lessonsSeeded = 0;
    let assetsUploaded = 0;

    for (const c of courses) {
        const { data: courseRow, error: cErr } = await supabase
            .from('lms_courses')
            .upsert(
                {
                    slug: c.slug,
                    order_index: c.orderIndex,
                    title: c.title,
                    description: c.description,
                    total_video_seconds: c.totalVideoSeconds,
                    source_folder: c.sourceFolder,
                },
                { onConflict: 'slug' },
            )
            .select('id')
            .single();

        if (cErr || !courseRow) throw new Error(`Failed to upsert course ${c.slug}: ${cErr?.message}`);

        for (const m of c.modules) {
            const { data: modRow, error: mErr } = await supabase
                .from('lms_modules')
                .upsert(
                    {
                        course_id: courseRow.id,
                        slug: m.slug,
                        order_index: m.orderIndex,
                        global_order: m.globalOrder,
                        title: m.title,
                        target_week: m.targetWeek,
                        estimated_minutes: m.estimatedMinutes,
                        source_folder: m.sourceFolder,
                    },
                    { onConflict: 'slug' },
                )
                .select('id')
                .single();

            if (mErr || !modRow) throw new Error(`Failed to upsert module ${m.slug}: ${mErr?.message}`);

            for (const l of m.lessons) {
                validLessonSlugs.add(l.slug);
                const storedAssets: Array<{ name: string; storage_path: string; type: string; is_exemplar: boolean }> = [];
                if (l.projectAssets?.length) {
                    for (const asset of l.projectAssets) {
                        const fileBuf = fs.readFileSync(asset.localPath);
                        const contentType =
                            asset.type === 'xlsx'
                                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                                : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                        const { error: upErr } = await supabase.storage
                            .from('lms-assets')
                            .upload(asset.storagePath, fileBuf, { contentType, upsert: true });
                        if (upErr) {
                            console.warn(`  [warn] Asset upload failed for ${asset.storagePath}: ${upErr.message}`);
                        } else {
                            assetsUploaded += 1;
                        }
                        storedAssets.push({
                            name: asset.name,
                            storage_path: asset.storagePath,
                            type: asset.type,
                            is_exemplar: asset.isExemplar,
                        });
                    }
                }

                // Apply preset verified quiz keys OR preserve existing admin-verified keys
                let quizPayload = l.quizQuestions || [];
                let quizKeysVerified = false;
                if (l.lessonType === 'quiz') {
                    const preset = presetQuizKeys[l.slug];
                    if (preset && quizPayload.length > 0) {
                        let allMapped = true;
                        quizPayload = quizPayload.map((q) => {
                            const ans = preset[q.id];
                            if (!ans || !Array.isArray(ans.correct_indices) || ans.correct_indices.length === 0) {
                                allMapped = false;
                                return q;
                            }
                            return {
                                ...q,
                                correct_indices: ans.correct_indices,
                                explanation: ans.explanation || q.explanation || '',
                            };
                        });
                        quizKeysVerified = allMapped;
                    } else {
                        const { data: existingLesson } = await supabase
                            .from('lms_lessons')
                            .select('quiz_questions_json, quiz_keys_verified')
                            .eq('slug', l.slug)
                            .maybeSingle();
                        if (existingLesson?.quiz_keys_verified) {
                            quizPayload = existingLesson.quiz_questions_json;
                            quizKeysVerified = true;
                        }
                    }
                }

                const { error: lErr } = await supabase.from('lms_lessons').upsert(
                    {
                        module_id: modRow.id,
                        slug: l.slug,
                        order_index: l.orderIndex,
                        global_order: l.globalOrder,
                        lesson_type: l.lessonType,
                        title: l.title,
                        source_path: l.sourcePath,
                        estimated_minutes: l.estimatedMinutes,
                        video_r2_key: l.videoR2Key || null,
                        duration_seconds: l.durationSeconds || 0,
                        chapters_json: l.chapters || [],
                        content_html: l.contentHtml || null,
                        word_count: l.wordCount || 0,
                        min_dwell_seconds: l.minDwellSeconds || 60,
                        quiz_questions_json: quizPayload,
                        quiz_keys_verified: quizKeysVerified,
                        project_brief: l.projectBrief || null,
                        project_assets_json: storedAssets,
                    },
                    { onConflict: 'slug' },
                );

                if (lErr) throw new Error(`Failed to upsert lesson ${l.slug}: ${lErr.message}`);
                lessonsSeeded += 1;
            }
        }
    }

    console.log(`Database seed complete: ${courses.length} courses, ${lessonsSeeded} lessons, ${assetsUploaded} project assets uploaded.`);
}

async function main() {
    console.log('Scanning course folder & building normalized manifest...');
    const courses = await buildManifest();

    let totalModules = 0;
    let totalVideos = 0;
    let totalReadings = 0;
    let totalQuizzes = 0;
    let totalQuizQuestions = 0;
    let totalProjects = 0;

    for (const c of courses) {
        totalModules += c.modules.length;
        for (const m of c.modules) {
            for (const l of m.lessons) {
                if (l.lessonType === 'video') totalVideos += 1;
                if (l.lessonType === 'reading') totalReadings += 1;
                if (l.lessonType === 'quiz') {
                    totalQuizzes += 1;
                    totalQuizQuestions += l.quizQuestions?.length || 0;
                }
                if (l.lessonType === 'project') totalProjects += 1;
            }
        }
    }

    console.log('\n=== MANIFEST SUMMARY ===');
    console.log(`Courses:   ${courses.length} (including Program Orientation)`);
    console.log(`Modules:   ${totalModules}`);
    console.log(`Videos:    ${totalVideos}`);
    console.log(`Readings:  ${totalReadings}`);
    console.log(`Quizzes:   ${totalQuizzes} (${totalQuizQuestions} parsed questions)`);
    console.log(`Projects:  ${totalProjects}`);

    fs.mkdirSync(path.dirname(PREVIEW_FILE), { recursive: true });
    // Save lightweight manifest preview (omit heavy HTML content)
    const preview = courses.map((c) => ({
        ...c,
        modules: c.modules.map((m) => ({
            ...m,
            lessons: m.lessons.map(({ contentHtml: _, ...rest }) => rest),
        })),
    }));
    fs.writeFileSync(PREVIEW_FILE, JSON.stringify(preview, null, 2));
    console.log(`Saved manifest preview to ${PREVIEW_FILE}`);

    if (DRY_RUN) {
        console.log('\nDry run complete. Pass --slice-videos, --upload-r2, --seed-db, or --all to execute.');
        return;
    }

    if (DO_SLICE && !DO_UPLOAD_R2) {
        console.log('\n--- Step 1: Slicing all videos locally with ffmpeg (-c copy) ---');
        sliceVideos(courses);
    }
    if (DO_UPLOAD_R2) {
        console.log('\n--- Step 1/2: Low-disk mode — slicing one video at a time, uploading to Cloudflare R2, and cleaning up ---');
        await uploadVideosToR2(courses, true);
    }
    if (DO_SEED_DB) {
        console.log('\n--- Step 3: Seeding Supabase database & project assets ---');
        await seedDatabaseAndAssets(courses);
    }
}

main().catch((err) => {
    console.error('Ingestion failed:', err);
    process.exit(1);
});
