import { resend, getFromAddress } from './resend.js';

// Every SplitSubs transactional email (PRD "Transactional Email (Resend)")
// goes through this one wrapper so the branded shell lives in one place;
// callers just supply the subject and the inner content block.
async function sendSplitsubsEmail(to: string | string[], subject: string, bodyHtml: string) {
    if (!resend) {
        console.warn('[splitsubs] RESEND_API_KEY missing — skipped email:', subject);
        return;
    }
    await resend.emails.send({
        from: getFromAddress('SplitSubs'),
        to,
        subject,
        html: `
      <div style="font-family: -apple-system, 'Inter', sans-serif; max-width: 560px; margin: auto; color: #1a1a1a; line-height: 1.6;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #888;">SplitSubs · by CortDevs</span>
        </div>
        ${bodyHtml}
        <p style="color: #999; font-size: 12px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee;">
          Questions about this? Reply to this email or open a support ticket from your SplitSubs dashboard.
        </p>
      </div>
    `,
    });
}

const money = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Sent by the daily renewal-reminder cron to everyone who asked to be
// notified when a sold-out listing has a seat open up (Feature Audit doc,
// Phase 3).
export async function sendSeatAvailableAgain(to: string, params: { serviceName: string; listingUrl: string }) {
    await sendSplitsubsEmail(to, `A seat just opened up on ${params.serviceName}`, `
    <h2 style="font-weight: 600;">Good news — a seat is open</h2>
    <p>You asked to be notified when a seat opened up on <strong>${params.serviceName}</strong>. One just did — seats go fast, so don't sleep on it.</p>
    <p><a href="${params.listingUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:4px;">Grab the Seat</a></p>
  `);
}

// Sent by splitsubs/signup.ts in place of Supabase's own hosted confirmation
// email — same branded shell as every other SplitSubs email, and carries
// BOTH a clickable confirmation link (for anyone who just wants to tap it)
// and the 6-digit OTP behind it (for /dashboard/verify, or anyone who
// distrusts email links and would rather type a code).
export async function sendSignupConfirmation(to: string, params: { confirmUrl: string; otp: string }) {
    await sendSplitsubsEmail(to, `Confirm your SplitSubs account — ${params.otp}`, `
    <h2 style="font-weight: 600;">One step from saving on your subscriptions</h2>
    <p>Confirm your email to activate your SplitSubs account — tap the button below, or enter this code if you're asked for one:</p>
    <div style="text-align:center; margin: 28px 0; padding: 20px; background:#f9f9f9;">
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 0 0 6px; font-family: monospace;">${params.otp}</p>
      <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #999; margin:0;">Your confirmation code</p>
    </div>
    <p style="text-align:center;"><a href="${params.confirmUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:4px;">Confirm My Account</a></p>
    <p style="color:#999; font-size:12px; margin-top:24px;">This code and link expire in an hour. Didn't try to sign up? You can safely ignore this email.</p>
  `);
}

export async function sendSeatPaidToJoiner(to: string, params: { serviceName: string; totalPaid: number; confirmByHours: number }) {
    await sendSplitsubsEmail(to, `You're in! ${params.serviceName} seat secured 🎉`, `
    <h2 style="font-weight: 600;">Nice one — you just saved yourself real money</h2>
    <p>Your payment of <strong>${money(params.totalPaid)}</strong> for a ${params.serviceName} seat is confirmed and sitting safe with us — not with the host. That's your protection.</p>
    <p>You'll get another email the moment your access is ready. When it lands, confirm it's working within <strong>${params.confirmByHours} hours</strong> — that's what releases the host's payout, and it's your window to flag any wahala before it closes.</p>
  `);
}

export async function sendNewJoinerToHost(to: string, params: { serviceName: string; listingTitle: string; slaHours: number; dashboardUrl: string }) {
    await sendSplitsubsEmail(to, `💰 Money waiting — grant access on "${params.listingTitle}"`, `
    <h2 style="font-weight: 600;">Someone just paid for your seat</h2>
    <p>A joiner secured a seat on your <strong>${params.listingTitle}</strong> (${params.serviceName}) listing and their payment is confirmed, held safe on our side.</p>
    <p>Grant their access within <strong>${params.slaHours} hours</strong> and your payout moves — the longer you wait, the longer your money waits too. Go to your dashboard to see exactly what they need.</p>
    <p><a href="${params.dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:4px;">Grant Access Now</a></p>
  `);
}

export async function sendAccessGrantedToJoiner(to: string, params: { serviceName: string; accessInfoHtml: string; confirmUrl: string; accessType?: 'invite' | 'shared_login' }) {
    const isInvite = params.accessType === 'invite';
    await sendSplitsubsEmail(to, `Your ${params.serviceName} ${isInvite ? 'invite is ready' : 'access is ready'} — confirm now`, `
    <h2 style="font-weight: 600;">You're good to go</h2>
    <p>${isInvite
            ? `The host has sent an invite for ${params.serviceName} — accept it using the details below:`
            : `The host has granted your access to ${params.serviceName}:`}</p>
    <div style="background:#f9f9f9;padding:16px;border-left:3px solid #000;margin:16px 0;">${params.accessInfoHtml}</div>
    <p>${isInvite
            ? `Once you've accepted the invite, confirm it below — don't leave it hanging. This is what releases the host's payout, and it locks in your seat for good.`
            : `Please confirm it's working now — don't leave it hanging. This is what releases the host's payout, and it locks in your seat for good.`}</p>
    <p><a href="${params.confirmUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:4px;">Confirm It's Working</a></p>
  `);
}

export async function sendPayoutProcessedToHost(to: string, params: { amount: number }) {
    await sendSplitsubsEmail(to, `💸 ${money(params.amount)} is on its way to you`, `
    <h2 style="font-weight: 600;">Withdrawal sent — nice work</h2>
    <p><strong>${money(params.amount)}</strong> from your SplitSubs wallet has been sent to your verified bank account.</p>
    <p>Got more unused seats sitting idle? List them too and keep the wallet growing.</p>
  `);
}

export async function sendRenewalReminder(to: string, params: { role: 'host' | 'joiner'; serviceName: string; renewalDate: string; dashboardUrl: string }) {
    await sendSplitsubsEmail(to, `Heads up — ${params.serviceName} renews on ${params.renewalDate}`, `
    <h2 style="font-weight: 600;">Renewal is coming — don't get caught out</h2>
    <p>Your ${params.serviceName} split renews on <strong>${params.renewalDate}</strong>.</p>
    ${params.role === 'host'
            ? `<p>Please confirm you've renewed the plan with the provider before then — your joiners are billed based on your confirmation, so don't keep them waiting.</p>`
            : `<p>Your seat will be re-billed automatically unless you cancel before then — no action needed if you're happy to continue.</p>`}
    <p><a href="${params.dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:4px;">Open dashboard</a></p>
  `);
}

export async function sendDisputeUpdate(to: string, params: { listingTitle: string; status: string; note?: string }) {
    await sendSplitsubsEmail(to, `Dispute update — ${params.listingTitle}`, `
    <h2 style="font-weight: 600;">Dispute status: ${params.status.replace(/_/g, ' ')}</h2>
    <p>There's an update on the dispute for <strong>${params.listingTitle}</strong>.</p>
    ${params.note ? `<p>${params.note}</p>` : ''}
  `);
}

export async function sendTicketUpdate(to: string, params: { subject: string; status: string }) {
    await sendSplitsubsEmail(to, `Update on your ticket: ${params.subject}`, `
    <h2 style="font-weight: 600;">We're on it — status: ${params.status}</h2>
    <p>Ticket: <strong>${params.subject}</strong></p>
    <p>Log in to your dashboard to see the full reply and respond if you need to.</p>
  `);
}

export async function sendHostVerificationStatus(to: string, params: { tier: string; approved: boolean }) {
    await sendSplitsubsEmail(to, params.approved ? "You're verified! 🎉" : 'One more step for verification', `
    <h2 style="font-weight: 600;">${params.approved ? `You're now ${params.tier.replace(/_/g, ' ')} verified` : 'We need a little more information'}</h2>
    <p>${params.approved ? "Faster payouts are unlocked on your account from now on. Go list those extra seats and start earning." : 'Please check your dashboard for what to resubmit — takes a minute, then you\'re fully set.'}</p>
  `);
}

// Sent to every admin when a host submits a new listing — the moderation
// queue has always existed silently; nothing told an admin a listing was
// actually waiting until they happened to open the dashboard.
export async function sendListingPendingReviewToAdmins(to: string[], params: { listingTitle: string; serviceName: string; hostEmail: string; shortId: string; adminUrl: string }) {
    await sendSplitsubsEmail(to, `New listing awaiting review — ${params.serviceName} (${params.shortId})`, `
    <h2 style="font-weight: 600;">A listing needs your review</h2>
    <p><strong>${params.listingTitle}</strong> (${params.serviceName}, ${params.shortId}) was just submitted by ${params.hostEmail} and is sitting in the moderation queue.</p>
    <p><a href="${params.adminUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:4px;">Review Listing</a></p>
  `);
}

export async function sendListingApprovedToHost(to: string, params: { listingTitle: string; serviceName: string; shortId: string; listingUrl: string }) {
    await sendSplitsubsEmail(to, `You're live! ${params.serviceName} listing approved 🎉`, `
    <h2 style="font-weight: 600;">Your listing is live</h2>
    <p><strong>${params.listingTitle}</strong> (${params.shortId}) passed review and is now visible to joiners.</p>
    <p><a href="${params.listingUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:4px;">View Your Listing</a></p>
  `);
}

export async function sendListingRejectedToHost(to: string, params: { listingTitle: string; serviceName: string; shortId: string; reason: string; dashboardUrl: string }) {
    await sendSplitsubsEmail(to, `Your ${params.serviceName} listing needs changes`, `
    <h2 style="font-weight: 600;">Your listing wasn't approved</h2>
    <p><strong>${params.listingTitle}</strong> (${params.shortId}) didn't pass review this time:</p>
    <div style="background:#f9f9f9;padding:16px;border-left:3px solid #000;margin:16px 0;">${params.reason}</div>
    <p>Fix what's flagged and resubmit from your dashboard whenever you're ready.</p>
    <p><a href="${params.dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:4px;">Open Dashboard</a></p>
  `);
}

export async function sendListingSuspendedToHost(to: string, params: { listingTitle: string; serviceName: string; shortId: string; reason?: string; dashboardUrl: string }) {
    await sendSplitsubsEmail(to, `Your ${params.serviceName} listing was suspended`, `
    <h2 style="font-weight: 600;">Your listing has been suspended</h2>
    <p><strong>${params.listingTitle}</strong> (${params.shortId}) is no longer visible to joiners.</p>
    ${params.reason ? `<div style="background:#f9f9f9;padding:16px;border-left:3px solid #000;margin:16px 0;">${params.reason}</div>` : ''}
    <p>Open a support ticket from your dashboard if you think this was a mistake.</p>
    <p><a href="${params.dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:4px;">Open Dashboard</a></p>
  `);
}
