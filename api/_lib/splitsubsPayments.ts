import { supabase } from './supabase.js';
import { escrowHoldHours, computeWalletEligibleAt, billingCycleDays } from './splitsubsFees.js';
import { logSplitsubsActivity } from './splitsubsAuditLog.js';
import { sendSeatPaidToJoiner, sendNewJoinerToHost } from './splitsubsEmail.js';

// Shared by the Paystack webhook and the verify-on-redirect fallback, which
// commonly race each other (a joiner is redirected back and calls
// payments-verify within a second or two of paying, often before Paystack's
// own webhook has landed) — so "idempotent" here means an atomic
// UPDATE ... WHERE status = 'pending' claim, not just a status check before
// acting. A plain read-then-write (SELECT status, branch in JS, then UPDATE)
// leaves a window where both callers read 'pending' and both proceed, which
// used to double-insert ss_escrow and double-send emails; the escrow row
// left releaseEscrowForSeat's .maybeSingle() erroring on >1 row later, so a
// host's payout could get stuck until a human noticed. The UPDATE's WHERE
// clause is evaluated under Postgres's row lock, so only one of two
// concurrent callers can ever match it — the loser sees 0 rows updated and
// backs off instead of continuing.
export async function finalizeSuccessfulPayment(paymentId: string) {
    const { data: payment, error: paymentError } = await supabase
        .from('ss_payments')
        .update({ status: 'success', verified_at: new Date().toISOString() })
        .eq('id', paymentId)
        .eq('status', 'pending')
        .select('*, ss_seats(*, ss_listings(*, ss_services(*)))')
        .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) return { alreadyProcessed: true }; // already claimed by the other caller, not pending, or doesn't exist

    const seat = payment.ss_seats;
    const listing = seat.ss_listings;
    const service = listing.ss_services;

    const { data: settings } = await supabase.from('ss_platform_settings').select('*').eq('id', 1).single();
    let holdHours = escrowHoldHours(service.risk_tier, settings);

    // A host with zero prior confirmed splits gets the extra new-host delay
    // added to THIS seat's hold window — their first-ever payout, not every
    // payout, per the PRD's "New/unverified hosts held to a longer first-
    // settlement delay until they build a track record."
    const { data: hostProfile } = await supabase.from('ss_host_profiles').select('completed_splits').eq('id', listing.host_id).maybeSingle();
    if (!hostProfile || hostProfile.completed_splits === 0) {
        holdHours += settings.new_host_settlement_delay_days * 24;
    }

    const releaseAt = new Date(Date.now() + holdHours * 60 * 60 * 1000).toISOString();

    await supabase.from('ss_escrow').insert([{
        seat_id: seat.id,
        payment_id: paymentId,
        amount: seat.seat_base + seat.service_charge,
        status: 'held',
        release_at: releaseAt,
    }]);

    await supabase.from('ss_seats').update({ status: 'escrow_held' }).eq('id', seat.id);

    await logSplitsubsActivity({
        actorType: 'system',
        actorId: null,
        actorLabel: 'Payment webhook',
        action: `Payment confirmed for seat on "${listing.title}" — held in escrow`,
        targetType: 'seat',
        targetId: seat.id,
        metadata: { amount: payment.amount, provider: payment.provider },
    });

    const [{ data: joiner }, { data: host }] = await Promise.all([
        supabase.auth.admin.getUserById(seat.joiner_id),
        supabase.auth.admin.getUserById(listing.host_id),
    ]);

    if (joiner?.user?.email) {
        await sendSeatPaidToJoiner(joiner.user.email, {
            serviceName: service.name,
            totalPaid: seat.total_paid,
            confirmByHours: holdHours,
        }).catch((e) => console.error('sendSeatPaidToJoiner failed:', e));
    }
    if (host?.user?.email) {
        await sendNewJoinerToHost(host.user.email, {
            serviceName: service.name,
            listingTitle: listing.title,
            slaHours: 24,
            dashboardUrl: `https://splitsubs.cortdevs.com/dashboard`,
        }).catch((e) => console.error('sendNewJoinerToHost failed:', e));
    }

    return { alreadyProcessed: false, seatId: seat.id, listingId: listing.id };
}

// Releases one seat's escrow — either the joiner explicitly confirmed access,
// or (cron) the hold window lapsed with no open dispute. Either path credits
// the host's wallet (locked until computeWalletEligibleAt — the 80%-of-cycle
// anti-scam gate, independent of how fast escrow itself cleared) and credits
// the insurance pool its configured slice of the service charge.
//
// Called from three independent places (access.ts's manual confirm, the
// daily cron sweep, and dispute resolution) that can legitimately overlap —
// e.g. a joiner clicks "confirm access" in the same window the cron sweep
// picks up the same seat because its hold lapsed a moment earlier. Same
// atomic-claim fix as finalizeSuccessfulPayment above: the release is an
// UPDATE ... WHERE status = 'held' (not a SELECT-then-UPDATE), so only one
// caller can ever win it — otherwise this used to double-insert a wallet
// credit and pay a host twice for one seat.
export async function releaseEscrowForSeat(seatId: string, reason: string) {
    const { data: seat, error } = await supabase
        .from('ss_seats')
        .select('*, ss_listings(id, host_id, title, ss_services(billing_cycle_unit, billing_cycle_count))')
        .eq('id', seatId)
        .maybeSingle();
    if (error || !seat) throw new Error('Seat not found.');

    const { data: openDispute } = await supabase
        .from('ss_disputes')
        .select('id')
        .eq('seat_id', seatId)
        .in('status', ['open', 'investigating'])
        .maybeSingle();
    if (openDispute) return; // frozen until the dispute resolves

    const { data: escrow, error: claimError } = await supabase
        .from('ss_escrow')
        .update({ status: 'released', released_at: new Date().toISOString(), release_reason: reason })
        .eq('seat_id', seatId)
        .eq('status', 'held')
        .select('id')
        .maybeSingle();
    if (claimError) throw claimError;
    if (!escrow) return; // already released/refunded by another caller, or no escrow (shouldn't happen post-payment)

    await supabase.from('ss_seats').update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
    }).eq('id', seatId).is('confirmed_at', null);

    const listing = seat.ss_listings;

    try {
        // Best-effort — a missing profile row here shouldn't block the credit.
        // Supabase's query/RPC builder is a thenable, not a real Promise, so it
        // has no .catch() of its own; chaining one directly threw
        // "supabase.rpc(...).catch is not a function" at runtime. try/catch
        // around the awaited call is the correct way to swallow this error.
        await supabase.rpc('ss_increment_completed_splits', { p_host_id: listing.host_id });
    } catch {
        // ignored — see comment above
    }

    const { data: settings } = await supabase.from('ss_platform_settings').select('*').eq('id', 1).single();

    const service = listing.ss_services;
    const cycleDays = billingCycleDays(service?.billing_cycle_unit || 'month', service?.billing_cycle_count || 1);
    const eligibleAt = computeWalletEligibleAt(new Date(), cycleDays, settings);
    await supabase.from('ss_wallet_transactions').insert([{
        host_id: listing.host_id,
        type: 'credit',
        amount: seat.seat_base,
        source: 'escrow_release',
        seat_id: seatId,
        listing_id: listing.id,
        eligible_at: eligibleAt.toISOString(),
    }]);

    const contribution = Math.round(seat.service_charge * settings.insurance_pool_contribution_rate * 100) / 100;
    if (contribution > 0) {
        await supabase.from('ss_insurance_pool_ledger').insert([{ direction: 'credit', amount: contribution, reason: 'Service charge contribution', seat_id: seatId }]);
        // Atomic (ss_increment_insurance_pool does `SET x = x + n` in SQL) —
        // settings.insurance_pool_balance above was read moments earlier for
        // the eligibility calc; adding to it in JS here would lose an update
        // whenever two releases finish close together.
        await supabase.rpc('ss_increment_insurance_pool', { p_amount: contribution });
    }

    await logSplitsubsActivity({
        actorType: 'system',
        actorId: null,
        actorLabel: 'Escrow release',
        action: `Escrow released for seat on "${listing.title}" (${reason})`,
        targetType: 'seat',
        targetId: seatId,
    });
}
