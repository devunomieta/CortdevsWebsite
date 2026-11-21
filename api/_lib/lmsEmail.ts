import { resend, getFromAddress } from './resend.js';
import { supabase } from './supabase.js';
import { getLearnAppUrl } from './appUrl.js';

function esc(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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
    const rawRecipients = Array.isArray(opts.to) ? opts.to : [opts.to];
    // Never send real Resend emails to RFC 2606 synthetic test domains (.test, .invalid, .example)
    const recipients = rawRecipients.filter((email) => !/\.(test|invalid|example)$/i.test(String(email).trim()));
    if (recipients.length === 0) return false;
    const primaryEmail = recipients[0];

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
            to: recipients,
            subject: opts.subject,
            html,
        };
        if (opts.cc) {
            const rawCc = Array.isArray(opts.cc) ? opts.cc : [opts.cc];
            const liveCc = rawCc.filter((email) => !/\.(test|invalid|example)$/i.test(String(email).trim()));
            if (liveCc.length > 0) payload.cc = liveCc;
        }

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
    `<p style="margin: 24px 0;"><a href="${esc(href)}" style="display:inline-block;padding:12px 24px;background:#030213;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">${esc(label)}</a></p>`;

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
            : `Your CortDevs Learn login details — ${params.cohortName}`,
        emailType: isReset ? 'credentials_reset' : 'credentials_created',
        cohortId: params.cohortId,
        userId: params.userId,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px; color: #030213;">${
                isReset ? `Password updated, ${esc(params.fullName)}` : `Welcome to CortDevs Learn, ${esc(params.fullName)}`
            }</h2>
            <p>${
                isReset
                    ? `An administrator has updated your password for <strong>${esc(params.cohortName)}</strong>. Use your updated login details below:`
                    : `Your account for <strong>${esc(params.cohortName)}</strong> is ready. Use the login details below to sign in and begin your course:`
            }</p>
            <div style="background: #f4f4f5; border: 1px solid #e4e4e7; padding: 16px 18px; margin: 18px 0; font-size: 14px;">
                <div style="margin-bottom: 6px;"><strong>Portal URL:</strong> <a href="${esc(loginUrl)}" style="color:#030213;">${esc(loginUrl)}</a></div>
                <div style="margin-bottom: 6px;"><strong>Email Address:</strong> ${esc(params.to)}</div>
                <div><strong>Password:</strong> <code style="background:#ffffff;padding:2px 8px;border:1px solid #d4d4d8;font-family:monospace;font-size:14px;">${esc(params.password)}</code></div>
            </div>
            ${!isReset ? `<p style="font-size: 13px; color: #52525b;"><strong>Course Start Date:</strong> ${esc(params.startDate)}</p>` : ''}
            ${ctaButton(loginUrl, 'Sign In to CortDevs Learn')}
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
            <h2 style="margin: 0 0 12px; font-size: 20px;">Nice work, ${esc(params.fullName)} — module completed!</h2>
            <p>You just finished <strong>${esc(params.completedModuleTitle)}</strong>.</p>
            <div style="background: #f4f4f5; padding: 14px 16px; margin: 16px 0; font-size: 14px;">
                <strong>Overall Progress:</strong> ${params.completedModulesCount} / ${params.totalModulesCount} modules (${pct}%)<br/>
                <strong>Study Streak:</strong> ${params.streak} day${params.streak === 1 ? '' : 's'}
            </div>
            ${params.nextModuleTitle ? `<p>Up next: <strong>${esc(params.nextModuleTitle)}</strong></p>` : ''}
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
    peerBuddyEmails?: string[];
    cohortId: string;
    userId: string;
    lessonId: string;
}) {
    await sendLmsEmail({
        to: params.learnerEmail,
        subject: `Assignment received: ${params.projectTitle} (Next lesson unlocked!)`,
        emailType: 'project_submitted_learner',
        cohortId: params.cohortId,
        userId: params.userId,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">Submission received, ${esc(params.learnerName)}</h2>
            <p>Your work for <strong>${esc(params.projectTitle)}</strong> has been saved and sent for review. Your next lesson is now <strong>unlocked</strong> so you can keep going without waiting.</p>
            ${ctaButton(`${getLearnAppUrl()}/dashboard`, 'Continue to Next Lesson')}
        `,
    });

    const peerEmails = [
        ...(params.peerBuddyEmail ? [params.peerBuddyEmail] : []),
        ...(params.peerBuddyEmails || []),
    ];
    const reviewers = [...new Set([...params.adminEmails, ...peerEmails])].filter(
        (e) => e && e.toLowerCase() !== params.learnerEmail.toLowerCase(),
    );
    if (reviewers.length > 0) {
        await sendLmsEmail({
            to: reviewers,
            subject: `Review needed: ${params.learnerName} submitted "${params.projectTitle}"`,
            emailType: 'project_submitted_reviewers',
            cohortId: params.cohortId,
            bodyHtml: `
                <h2 style="margin: 0 0 12px; font-size: 20px;">New assignment ready for review</h2>
                <p><strong>${esc(params.learnerName)}</strong> just submitted their work for <strong>${esc(params.projectTitle)}</strong>.</p>
                <p>Leave feedback and approve it from the Team Dashboard.</p>
                ${ctaButton(`${getLearnAppUrl()}/admin`, 'Open Project Reviews')}
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
    const safeFeedback = esc(params.feedback || (approved ? 'Great job!' : 'Please review the notes and upload an updated version.')).replace(/\n/g, '<br/>');
    return sendLmsEmail({
        to: params.to,
        subject: approved
            ? `Approved: ${params.projectTitle}`
            : `Feedback ready (changes requested): ${params.projectTitle}`,
        emailType: 'project_reviewed',
        cohortId: params.cohortId,
        userId: params.userId,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">${approved ? 'Your assignment was approved!' : 'Feedback ready on your assignment'}</h2>
            <p>Hi ${esc(params.learnerName)}, your work for <strong>${esc(params.projectTitle)}</strong> has been reviewed.</p>
            <div style="background: #f4f4f5; border-left: 3px solid ${approved ? '#10b981' : '#f59e0b'}; padding: 12px 16px; margin: 16px 0; font-size: 14px;">
                <strong>Reviewer Feedback:</strong><br/>${safeFeedback}
            </div>
            ${ctaButton(`${getLearnAppUrl()}/lesson/${params.lessonId}`, approved ? 'View Feedback' : 'Upload Updated File')}
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
            <h2 style="margin: 0 0 12px; font-size: 20px;">Ready for today's study session, ${esc(params.fullName)}?</h2>
            <p>Pick up right where you left off in <strong>${esc(params.moduleTitle)}</strong>:</p>
            <div style="background: #f4f4f5; padding: 14px 16px; margin: 16px 0; font-size: 14px;">
                <strong>Next Lesson:</strong> ${esc(params.nextLessonTitle)} (~${params.nextLessonMinutes} min)<br/>
                <strong>Your Progress:</strong> ${params.progressPct}% (This Week's Goal: ${params.targetPct}% · <em>${paceLabel}</em>)<br/>
                <strong>Study Streak:</strong> ${params.streak} day${params.streak === 1 ? '' : 's'}
            </div>
            ${ctaButton(`${getLearnAppUrl()}/lesson/${params.nextLessonId}`, 'Start Next Lesson')}
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
              : `Quick check-in on your course progress`;

    return sendLmsEmail({
        to: params.to,
        cc: tier === 'day7' ? params.ccAdmins : undefined,
        subject: `${headline} (${params.daysInactive} days since last lesson)`,
        emailType: `inactivity_${tier}`,
        cohortId: params.cohortId,
        userId: params.userId,
        idempotencyKey: `inactivity_${tier}:${params.userId}:${params.dateKey}`,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">${esc(headline)}</h2>
            <p>It's been <strong>${params.daysInactive} days</strong> since your last lesson on CortDevs Learn. Your next lesson is waiting:</p>
            <p style="background: #fffbeb; border-left: 3px solid #f59e0b; padding: 12px 16px; font-size: 14px;">
                <strong>Up Next:</strong> ${esc(params.nextLessonTitle)}
            </p>
            <p>${tier === 'day7' ? 'Your team lead is CC’d here so we can help clear any blockers together.' : 'Even knocking out one 15-minute video or reading today restarts your momentum.'}</p>
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
        subject: `Message from ${params.senderName} — CortDevs Learn`,
        emailType: 'manual_nudge',
        cohortId: params.cohortId,
        userId: params.userId,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">Note from ${esc(params.senderName)}</h2>
            <p>Hi ${esc(params.fullName)},</p>
            <div style="background: #f4f4f5; border-left: 3px solid #030213; padding: 14px 16px; margin: 16px 0; font-size: 14px;">
                ${esc(params.message).replace(/\n/g, '<br/>')}
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
    qaAnsweredThisWeek?: number;
    qaOpenCount?: number;
    cohortId: string;
    userId: string;
    weekKey: string;
}) {
    const modList = params.newlyUnlockedModules.length
        ? `<ul style="padding-left: 20px; margin: 8px 0;">${params.newlyUnlockedModules.map((m) => `<li><strong>${esc(m)}</strong></li>`).join('')}</ul>`
        : `<p>Keep finishing your current unlocked modules at your own pace.</p>`;

    const qaNote =
        (params.qaAnsweredThisWeek || 0) > 0 || (params.qaOpenCount || 0) > 0
            ? `<br/><strong>Team Session Q&amp;A:</strong> ${params.qaAnsweredThisWeek || 0} answered this week · ${params.qaOpenCount || 0} queued for next session`
            : '';

    return sendLmsEmail({
        to: params.to,
        subject: `Week ${params.weekNumber} is live! New lessons unlocked on CortDevs Learn`,
        emailType: 'monday_drip_learner',
        cohortId: params.cohortId,
        userId: params.userId,
        idempotencyKey: `monday_drip:${params.userId}:${params.weekKey}`,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">Happy Monday, ${esc(params.fullName)} — Week ${params.weekNumber} is unlocked!</h2>
            <p>This week's modules are now open on your course page:</p>
            ${modList}
            <div style="background: #f4f4f5; padding: 14px 16px; margin: 16px 0; font-size: 14px;">
                <strong>Last 7 Days:</strong> ${params.lessonsCompletedLastWeek} lessons completed<br/>
                <strong>Overall Progress:</strong> ${params.progressPct}%<br/>
                <strong>Study Streak:</strong> ${params.streak} day${params.streak === 1 ? '' : 's'}${qaNote}
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
    qaAnsweredThisWeek?: number;
    qaOpenCount?: number;
    learnersSummaryRows: Array<{ fullName: string; progressPct: number; last7d: number; streak: number }>;
    cohortId: string;
    weekKey: string;
}) {
    const rowsHtml = params.learnersSummaryRows
        .map(
            (r) =>
                `<tr>
                    <td style="padding:8px;border-bottom:1px solid #e4e4e7;"><strong>${esc(r.fullName)}</strong></td>
                    <td style="padding:8px;border-bottom:1px solid #e4e4e7;">${r.progressPct}%</td>
                    <td style="padding:8px;border-bottom:1px solid #e4e4e7;">+${r.last7d} lessons</td>
                    <td style="padding:8px;border-bottom:1px solid #e4e4e7;">${r.streak}d</td>
                </tr>`,
        )
        .join('');

    const tableHtml = `
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
            <thead>
                <tr style="background:#f4f4f5;text-align:left;">
                    <th style="padding:8px;border-bottom:2px solid #e4e4e7;">Member</th>
                    <th style="padding:8px;border-bottom:2px solid #e4e4e7;">Progress</th>
                    <th style="padding:8px;border-bottom:2px solid #e4e4e7;">Last 7 Days</th>
                    <th style="padding:8px;border-bottom:2px solid #e4e4e7;">Streak</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;

    return sendLmsEmail({
        to: params.to,
        subject: `Weekly Team Progress (Week ${params.weekNumber}) — ${params.cohortName}`,
        emailType: 'monday_digest_admin',
        cohortId: params.cohortId,
        idempotencyKey: `monday_admin:${params.cohortId}:${params.weekKey}`,
        bodyHtml: `
            <h2 style="margin: 0 0 12px; font-size: 20px;">Week ${params.weekNumber} Team Progress Report</h2>
            <p><strong>${esc(params.cohortName)}</strong> · Projects Waiting for Review: <strong>${params.pendingReviewsCount}</strong> · Session Q&amp;A: <strong>${params.qaOpenCount || 0} open</strong> (${params.qaAnsweredThisWeek || 0} answered this week)</p>
            ${tableHtml}
            ${ctaButton(`${getLearnAppUrl()}/admin`, 'Open Team Dashboard')}
        `,
    });
}
