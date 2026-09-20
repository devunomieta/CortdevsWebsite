import { resend, getFromAddress } from './resend.js';

// Every SplitSubs transactional email (PRD "Transactional Email (Resend)")
// goes through this one wrapper so the branded shell lives in one place;
// callers just supply the subject and the inner content block.
async function sendSplitsubsEmail(to: string, subject: string, bodyHtml: string) {
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

export async function sendSeatPaidToJoiner(to: string, params: { serviceName: string; totalPaid: number; confirmByHours: number }) {
    await sendSplitsubsEmail(to, `Payment received — ${params.serviceName} seat`, `
    <h2 style="font-weight: 600;">You're in — payment confirmed</h2>
    <p>We've received your payment of <strong>${money(params.totalPaid)}</strong> for a ${params.serviceName} seat. It's held in escrow while the host sets up your access.</p>
    <p>You'll get another email the moment access is granted. Please confirm it works within <strong>${params.confirmByHours} hours</strong> of that email — that's what releases the host's payout, and it's your window to flag a problem before it closes.</p>
  `);
}

export async function sendNewJoinerToHost(to: string, params: { serviceName: string; listingTitle: string; slaHours: number; dashboardUrl: string }) {
    await sendSplitsubsEmail(to, `New joiner paid for "${params.listingTitle}"`, `
    <h2 style="font-weight: 600;">A joiner just paid for a seat</h2>
    <p>Someone joined your <strong>${params.listingTitle}</strong> (${params.serviceName}) listing and payment is confirmed and held in escrow.</p>
    <p>Please grant their access within <strong>${params.slaHours} hours</strong> — go to your dashboard to see exactly what they need.</p>
    <p><a href="${params.dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:4px;">Open dashboard</a></p>
  `);
}

export async function sendAccessGrantedToJoiner(to: string, params: { serviceName: string; accessInfoHtml: string; confirmUrl: string }) {
    await sendSplitsubsEmail(to, `Your ${params.serviceName} access is ready`, `
    <h2 style="font-weight: 600;">Access granted</h2>
    <p>The host has granted your access to ${params.serviceName}:</p>
    <div style="background:#f9f9f9;padding:16px;border-left:3px solid #000;margin:16px 0;">${params.accessInfoHtml}</div>
    <p>Please confirm it works — this is what releases the host's payout.</p>
    <p><a href="${params.confirmUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:4px;">Confirm access works</a></p>
  `);
}

export async function sendPayoutProcessedToHost(to: string, params: { amount: number; listingTitle: string }) {
    await sendSplitsubsEmail(to, `Payout sent — ${money(params.amount)}`, `
    <h2 style="font-weight: 600;">Payout on its way</h2>
    <p><strong>${money(params.amount)}</strong> for <strong>${params.listingTitle}</strong> has been sent to your verified bank account.</p>
  `);
}

export async function sendRenewalReminder(to: string, params: { role: 'host' | 'joiner'; serviceName: string; renewalDate: string; dashboardUrl: string }) {
    await sendSplitsubsEmail(to, `Renewal coming up — ${params.serviceName}`, `
    <h2 style="font-weight: 600;">Renewal reminder</h2>
    <p>Your ${params.serviceName} split renews on <strong>${params.renewalDate}</strong>.</p>
    ${params.role === 'host'
            ? `<p>Please confirm you've renewed the plan with the provider before then — joiners are billed based on your confirmation.</p>`
            : `<p>Your seat will be re-billed automatically unless you cancel before then.</p>`}
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
    await sendSplitsubsEmail(to, `Support ticket update: ${params.subject}`, `
    <h2 style="font-weight: 600;">Your ticket status is now: ${params.status}</h2>
    <p>Ticket: <strong>${params.subject}</strong></p>
  `);
}

export async function sendHostVerificationStatus(to: string, params: { tier: string; approved: boolean }) {
    await sendSplitsubsEmail(to, params.approved ? 'Verification approved' : 'Verification needs another look', `
    <h2 style="font-weight: 600;">${params.approved ? `You're now ${params.tier.replace(/_/g, ' ')} verified` : 'We need more information'}</h2>
    <p>${params.approved ? 'Faster settlement is now unlocked on your account.' : 'Please check your dashboard for what to resubmit.'}</p>
  `);
}
