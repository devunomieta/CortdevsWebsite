import { resend, getFromAddress } from './resend.js';
import { supabase } from './supabase.js';
import { getLearnAppUrl } from './appUrl.js';

interface SendLmsEmailOptions {
    to: string | string[];
    cc?: string | string[];
    subject: string;
    bodyHtml: string;
    emailType: string;
    cohortId?: string | null;
    userId?: string | null;
    idempotencyKey?: string;
}

async function sendLmsEmail(opts: SendLmsEmailOptions): Promise<boolean> {
    const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
    const primaryEmail = recipients[0];

    // Idempotency guard so Vercel Crons or retries never double-send the same email
    if (opts.idempotencyKey) {
        const { data: existing } = await supabase
            .from('lms_email_logs')
            .select('id')
            .eq('idempotency_key', opts.idempotencyKey)
            .maybeSingle();
        if (existing) return false;
    }

    if (!resend) {
        console.warn('[lmsEmail] RESEND_API_KEY missing — skipped email:', opts.subject);
        return false;
    }

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; max-width: 580px; margin: 0 auto; color: #111827; line-height: 1.65; background: #ffffff; padding: 28px; border: 1px solid #e4e4e7;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e4e4e7;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; color: #030213;">CortDevs · Learn</span>
        </div>
        ${opts.bodyHtml}
        <p style="color: #71717a; font-size: 12px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #f4f4f5;">
          You're receiving this as a member of the CortDevs Microsoft AI Product Manager cohort.
          <a href="${getLearnAppUrl()}/settings" style="color: #030213; text-decoration: underline;">Manage reminder schedule</a>.
        </p>
      </div>
    `;

    try {
        const payload: any = {
            from: getFromAddress('CortDevs Learn'),
            to: opts.to,
            subject: opts.subject,
            html,
        };
        if (opts.cc) payload.cc = opts.cc;

        const result = await resend.emails.send(payload);
        await supabase.from('lms_email_logs').insert({
            cohort_id: opts.cohortId || null,
            user_id: opts.userId || null,
            recipient_email: primaryEmail,
            email_type: opts.emailType,
            idempotency_key: opts.idempotencyKey || null,
            resend_message_id: (result as any)?.data?.id || null,
            status: 'sent',
        });
        return true;
    } catch (err: any) {
        console.error('[lmsEmail] Send failed:', err);
        await supabase.from('lms_email_logs').insert({
            cohort_id: opts.cohortId || null,
            user_id: opts.userId || null,
            recipient_email: primaryEmail,
            email_type: opts.emailType,
            idempotency_key: opts.idempotencyKey || null,
            status: 'failed',
            error_message: err?.message || String(err),
        });
        return false;
    }
}

const ctaButton = (href: string, label: string) =>
    `<p style="margin: 24px 0;"><a href="${href}" style="display:inline-block;padding:12px 24px;background:#030213;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">${label}</a></p>`;

export async function sendLmsCredentialsEmail(params: {
    to: string;
    fullName: string;
    password: string;
    cohortName: string;
    startDate: string;
    isPasswordReset?: boolean;
    cohortId: string;
    userId: string;
}) {
    const loginUrl = `${getLearnAppUrl()}/login`;
    const isReset = Boolean(params.isPasswordReset);
    return sendLmsEmail({
        to: params.to,
        subject: isReset
            ? `Your CortDevs Learn password was updated`
            : `Your CortDevs Learn login credentials — ${params.cohortName}`,
        emailType: isReset ? 'credentials_reset' : 'credentials_created',
        cohortId: params.cohortId,
        userId: params.userId,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px; color: #030213;">${
                isReset ? `Password updated, ${params.fullName}` : `Welcome to CortDevs Learn, ${params.fullName}`
            }</h2>
            <p>${
                isReset
                    ? `An administrator has updated your password for <strong>${params.cohortName}</strong>. Use your updated credentials below to sign in:`
                    : `Your access account for <strong>${params.cohortName}</strong> has been created. Use the credentials below to sign in and begin your course:`
            }</p>
            <div style="background: #f4f4f5; border: 1px solid #e4e4e7; padding: 16px 18px; margin: 18px 0; font-size: 14px;">
                <div style="margin-bottom: 6px;"><strong>Portal URL:</strong> <a href="${loginUrl}" style="color:#030213;">${loginUrl}</a></div>
                <div style="margin-bottom: 6px;"><strong>Email Address:</strong> ${params.to}</div>
                <div><strong>Password:</strong> <code style="background:#ffffff;padding:2px 8px;border:1px solid #d4d4d8;font-family:monospace;font-size:14px;">${params.password}</code></div>
            </div>
            ${!isReset ? `<p style="font-size: 13px; color: #52525b;"><strong>Cohort Start Date:</strong> ${params.startDate}</p>` : ''}
            ${ctaButton(loginUrl, 'Sign In to CortDevs Learn')}
        `,
    });
}

export async function sendLmsInvite(params: {
    to: string;
    fullName?: string;
    cohortName: string;
    startDate: string;
    inviteToken: string;
    cohortId: string;
}) {
    const signupUrl = `${getLearnAppUrl()}/signup?token=${encodeURIComponent(params.inviteToken)}&email=${encodeURIComponent(params.to)}`;
    return sendLmsEmail({
        to: params.to,
        subject: `You're invited: ${params.cohortName}`,
        emailType: 'invite',
        cohortId: params.cohortId,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">Welcome to the team cohort${params.fullName ? `, ${params.fullName}` : ''}</h2>
            <p>You've been invited to join <strong>${params.cohortName}</strong> on CortDevs Learn.</p>
            <p>We're completing the 5-course <strong>Microsoft AI Product Manager</strong> curriculum together over 12 weeks with sequential mastery unlocks, weekly Monday drips, and Friday team syncs.</p>
            <p style="background: #f9fafb; padding: 12px 16px; border-radius: 8px; font-size: 13px;">
                <strong>Cohort Start Date:</strong> ${params.startDate}<br/>
                <strong>Weekly Rhythm:</strong> ~60 min/day (Mon–Fri) + Friday 45-min Team Sync
            </p>
            ${ctaButton(signupUrl, 'Accept Invite & Create Account')}
        `,
    });
}

export async function sendLmsWelcome(params: {
    to: string;
    fullName: string;
    cohortName: string;
    cohortId: string;
    userId: string;
}) {
    return sendLmsEmail({
        to: params.to,
        subject: `You're in! Start Course Introduction — ${params.cohortName}`,
        emailType: 'welcome',
        cohortId: params.cohortId,
        userId: params.userId,
        idempotencyKey: `welcome:${params.cohortId}:${params.userId}`,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">Let's get started, ${params.fullName}</h2>
            <p>Your account is active for <strong>${params.cohortName}</strong>. Your first step is the 3-minute <strong>Course Introduction</strong> video, which unlocks Course 1, Module 1.</p>
            <p><strong>Pro tip:</strong> Block a recurring 60-minute "Power Hour" on your calendar today so your daily learning reminder lines up with uninterrupted study time.</p>
            ${ctaButton(`${getLearnAppUrl()}/dashboard`, 'Open Your Learning Roadmap')}
        `,
    });
}

export async function sendLmsModuleCompleted(params: {
    to: string;
    fullName: string;
    completedModuleTitle: string;
    nextModuleTitle?: string;
    nextLessonId?: string;
    completedModulesCount: number;
    totalModulesCount: number;
    streak: number;
    cohortId: string;
    userId: string;
    moduleId: string;
}) {
    const pct = Math.round((params.completedModulesCount / Math.max(1, params.totalModulesCount)) * 100);
    const nextUrl = params.nextLessonId ? `${getLearnAppUrl()}/lesson/${params.nextLessonId}` : `${getLearnAppUrl()}/dashboard`;
    return sendLmsEmail({
        to: params.to,
        subject: `Module complete: ${params.completedModuleTitle} (${pct}% done!)`,
        emailType: 'module_completed',
        cohortId: params.cohortId,
        userId: params.userId,
        idempotencyKey: `module_complete:${params.userId}:${params.moduleId}`,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">Nice work, ${params.fullName} — module cleared!</h2>
            <p>You just completed <strong>${params.completedModuleTitle}</strong>.</p>
            <div style="background: #f9fafb; border-radius: 8px; padding: 14px 16px; margin: 16px 0; font-size: 14px;">
                <strong>Program Progress:</strong> ${params.completedModulesCount} / ${params.totalModulesCount} modules (${pct}%)<br/>
                <strong>Active Streak:</strong> ${params.streak} day${params.streak === 1 ? '' : 's'}
            </div>
            ${params.nextModuleTitle ? `<p>Up next: <strong>${params.nextModuleTitle}</strong></p>` : ''}
            ${ctaButton(nextUrl, 'Continue Learning')}
        `,
    });
}

export async function sendLmsProjectSubmitted(params: {
    learnerEmail: string;
    learnerName: string;
    projectTitle: string;
    adminEmails: string[];
    peerBuddyEmail?: string | null;
    cohortId: string;
    userId: string;
    lessonId: string;
}) {
    // 1. Receipt to learner confirming auto-unlock
    await sendLmsEmail({
        to: params.learnerEmail,
        subject: `Project received: ${params.projectTitle} (Next module unlocked!)`,
        emailType: 'project_submitted_learner',
        cohortId: params.cohortId,
        userId: params.userId,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">Submission received, ${params.learnerName}</h2>
            <p>Your deliverable for <strong>${params.projectTitle}</strong> has been saved and queued for async review. Your next lesson is now <strong>unlocked</strong> so you can keep moving without waiting.</p>
            ${ctaButton(`${getLearnAppUrl()}/dashboard`, 'Continue to Next Lesson')}
        `,
    });

    // 2. Notification to Admin(s) and Peer Buddy
    const reviewers = [...new Set([...params.adminEmails, ...(params.peerBuddyEmail ? [params.peerBuddyEmail] : [])])].filter(
        (e) => e && e.toLowerCase() !== params.learnerEmail.toLowerCase(),
    );
    if (reviewers.length > 0) {
        await sendLmsEmail({
            to: reviewers,
            subject: `Review needed: ${params.learnerName} submitted "${params.projectTitle}"`,
            emailType: 'project_submitted_reviewers',
            cohortId: params.cohortId,
            bodyHtml: `
                <h2 style="margin: 0 0 12px; font-size: 20px;">New project deliverable ready for review</h2>
                <p><strong>${params.learnerName}</strong> just submitted their work for <strong>${params.projectTitle}</strong>.</p>
                <p>Leave constructive feedback and approve (or request revisions) in the Admin Review Queue.</p>
                ${ctaButton(`${getLearnAppUrl()}/admin`, 'Open Review Queue')}
            `,
        });
    }
}

export async function sendLmsProjectReviewed(params: {
    to: string;
    learnerName: string;
    projectTitle: string;
    status: 'approved' | 'revision_requested';
    feedback: string;
    lessonId: string;
    cohortId: string;
    userId: string;
}) {
    const approved = params.status === 'approved';
    return sendLmsEmail({
        to: params.to,
        subject: approved
            ? `Approved: ${params.projectTitle}`
            : `Feedback ready (revision requested): ${params.projectTitle}`,
        emailType: 'project_reviewed',
        cohortId: params.cohortId,
        userId: params.userId,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">${approved ? 'Your project was approved!' : 'Feedback ready on your project'}</h2>
            <p>Hi ${params.learnerName}, your submission for <strong>${params.projectTitle}</strong> has been reviewed.</p>
            <div style="background: #f9fafb; border-left: 3px solid ${approved ? '#10b981' : '#f59e0b'}; padding: 12px 16px; margin: 16px 0; font-size: 14px;">
                <strong>Reviewer Feedback:</strong><br/>${params.feedback || (approved ? 'Great job!' : 'Please review the notes and upload an updated version.')}
            </div>
            ${ctaButton(`${getLearnAppUrl()}/lesson/${params.lessonId}`, approved ? 'View Feedback' : 'Upload Revised Deliverable')}
        `,
    });
}

export async function sendLmsDailyReminder(params: {
    to: string;
    fullName: string;
    nextLessonTitle: string;
    nextLessonId: string;
    nextLessonMinutes: number;
    moduleTitle: string;
    progressPct: number;
    targetPct: number;
    streak: number;
    cohortId: string;
    userId: string;
    dateKey: string;
}) {
    const paceLabel =
        params.progressPct >= params.targetPct
            ? 'On track'
            : params.targetPct - params.progressPct <= 10
              ? 'Slightly behind'
              : 'Needs catch-up';
    return sendLmsEmail({
        to: params.to,
        subject: `Daily study reminder • Up next: ${params.nextLessonTitle} (${params.nextLessonMinutes} min)`,
        emailType: 'daily_reminder',
        cohortId: params.cohortId,
        userId: params.userId,
        idempotencyKey: `daily_reminder:${params.userId}:${params.dateKey}`,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">Ready for today's learning block, ${params.fullName}?</h2>
            <p>Pick up right where you left off in <strong>${params.moduleTitle}</strong>:</p>
            <div style="background: #f9fafb; border-radius: 8px; padding: 14px 16px; margin: 16px 0; font-size: 14px;">
                <strong>Next Lesson:</strong> ${params.nextLessonTitle} (~${params.nextLessonMinutes} min)<br/>
                <strong>Your Progress:</strong> ${params.progressPct}% (Cohort Target Today: ${params.targetPct}% · <em>${paceLabel}</em>)<br/>
                <strong>Current Streak:</strong> ${params.streak} day${params.streak === 1 ? '' : 's'}
            </div>
            ${ctaButton(`${getLearnAppUrl()}/lesson/${params.nextLessonId}`, 'Jump Into Next Lesson')}
        `,
    });
}

export async function sendLmsInactivityNudge(params: {
    to: string;
    ccAdmins?: string[];
    fullName: string;
    daysInactive: number;
    nextLessonTitle: string;
    nextLessonId: string;
    cohortId: string;
    userId: string;
    dateKey: string;
}) {
    const tier = params.daysInactive >= 7 ? 'day7' : params.daysInactive >= 5 ? 'day5' : 'day3';
    const headline =
        tier === 'day7'
            ? `Let's get you unstuck, ${params.fullName}`
            : tier === 'day5'
              ? `Just 20 minutes today gets you back on track`
              : `Quick check-in on your AI PM cohort progress`;

    return sendLmsEmail({
        to: params.to,
        cc: tier === 'day7' ? params.ccAdmins : undefined,
        subject: `${headline} (${params.daysInactive} days since last lesson)`,
        emailType: `inactivity_${tier}`,
        cohortId: params.cohortId,
        userId: params.userId,
        idempotencyKey: `inactivity_${tier}:${params.userId}:${params.dateKey}`,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">${headline}</h2>
            <p>It's been <strong>${params.daysInactive} days</strong> since your last activity on CortDevs Learn. Your next unlocked lesson is waiting:</p>
            <p style="background: #fffbeb; border-left: 3px solid #f59e0b; padding: 12px 16px; border-radius: 6px; font-size: 14px;">
                <strong>Next Up:</strong> ${params.nextLessonTitle}
            </p>
            <p>${tier === 'day7' ? 'Your team lead is CC’d here so we can help clear any blockers or adjust your pace together.' : 'Even knocking out one 15-minute video or reading today restarts your momentum.'}</p>
            ${ctaButton(`${getLearnAppUrl()}/lesson/${params.nextLessonId}`, 'Resume Where You Left Off')}
        `,
    });
}

export async function sendLmsManualNudge(params: {
    to: string;
    fullName: string;
    senderName: string;
    message: string;
    cohortId: string;
    userId: string;
}) {
    return sendLmsEmail({
        to: params.to,
        subject: `Message from ${params.senderName} — CortDevs AI PM Cohort`,
        emailType: 'manual_nudge',
        cohortId: params.cohortId,
        userId: params.userId,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">Quick note from ${params.senderName}</h2>
            <p>Hi ${params.fullName},</p>
            <div style="background: #f9fafb; border-left: 3px solid #4f46e5; padding: 14px 16px; margin: 16px 0; font-size: 14px;">
                ${params.message.replace(/\n/g, '<br/>')}
            </div>
            ${ctaButton(`${getLearnAppUrl()}/dashboard`, 'Open CortDevs Learn')}
        `,
    });
}

export async function sendLmsMondayDripLearner(params: {
    to: string;
    fullName: string;
    weekNumber: number;
    newlyUnlockedModules: string[];
    lessonsCompletedLastWeek: number;
    progressPct: number;
    streak: number;
    cohortId: string;
    userId: string;
    weekKey: string;
}) {
    const modList = params.newlyUnlockedModules.length
        ? `<ul style="padding-left: 20px; margin: 8px 0;">${params.newlyUnlockedModules.map((m) => `<li><strong>${m}</strong></li>`).join('')}</ul>`
        : `<p>Keep finishing your current unlocked modules at your own pace.</p>`;

    return sendLmsEmail({
        to: params.to,
        subject: `Week ${params.weekNumber} is live! New modules unlocked on CortDevs Learn`,
        emailType: 'monday_drip_learner',
        cohortId: params.cohortId,
        userId: params.userId,
        idempotencyKey: `monday_drip:${params.userId}:${params.weekKey}`,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">Happy Monday, ${params.fullName} — Week ${params.weekNumber} is unlocked!</h2>
            <p>This week's cohort modules are now eligible on your roadmap:</p>
            ${modList}
            <div style="background: #f9fafb; border-radius: 8px; padding: 14px 16px; margin: 16px 0; font-size: 14px;">
                <strong>Last 7 Days:</strong> ${params.lessonsCompletedLastWeek} lessons completed<br/>
                <strong>Overall Program Progress:</strong> ${params.progressPct}%<br/>
                <strong>Current Streak:</strong> ${params.streak} day${params.streak === 1 ? '' : 's'}
            </div>
            ${ctaButton(`${getLearnAppUrl()}/dashboard`, `Start Week ${params.weekNumber}`)}
        `,
    });
}

export async function sendLmsMondayAdminDigest(params: {
    to: string[];
    cohortName: string;
    weekNumber: number;
    pendingReviewsCount: number;
    learnersSummaryHtml: string;
    cohortId: string;
    weekKey: string;
}) {
    return sendLmsEmail({
        to: params.to,
        subject: `Weekly Cohort Report (Week ${params.weekNumber}) — ${params.cohortName}`,
        emailType: 'monday_digest_admin',
        cohortId: params.cohortId,
        idempotencyKey: `monday_admin:${params.cohortId}:${params.weekKey}`,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">Week ${params.weekNumber} Team Accountability Digest</h2>
            <p><strong>${params.cohortName}</strong> · Pending Project Reviews: <strong>${params.pendingReviewsCount}</strong></p>
            ${params.learnersSummaryHtml}
            ${ctaButton(`${getLearnAppUrl()}/admin`, 'Open Admin Accountability Dashboard')}
        `,
    });
}
