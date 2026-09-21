import { supabase } from './supabase.js';
import { escrowHoldHours } from './splitsubsFees.js';
import { logSplitsubsActivity } from './splitsubsAuditLog.js';
import { sendSeatPaidToJoiner, sendNewJoinerToHost } from './splitsubsEmail.js';

// Shared by the Paystack webhook and the verify-on-redirect fallback so a
// payment is finalized exactly once however its confirmation arrives first.
// Idempotent: a payment already 'success' is a no-op.
export async function finalizeSuccessfulPayment(paymentId: string) {
    const { data: payment, error: paymentError } = await supabase
        .from('ss_payments')
        .select('*, ss_seats(*, ss_listings(*, ss_services(*)))')
        .eq('id', paymentId)
        .maybeSingle();
    if (paymentError || !payment) throw new Error('Payment not found.');
    if (payment.status === 'success') return { alreadyProcessed: true };

    const seat = payment.ss_seats;
    const listing = seat.ss_listings;
    const service = listing.ss_services;

    await supabase.from('ss_payments').update({ status: 'success', verified_at: new Date().toISOString() }).eq('id', paymentId);

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
// or (cron) the hold window lapsed with no open dispute. Either path creates
// the pending settlement row that the admin payout run later sweeps up, and
// credits the insurance pool its configured slice of the service charge.
export async function releaseEscrowForSeat(seatId: string, reason: string) {
    const { data: seat, error } = await supabase
        .from('ss_seats')
        .select('*, ss_listings(id, host_id, title)')
        .eq('id', seatId)
        .maybeSingle();
    if (error || !seat) throw new Error('Seat not found.');

    const { data: escrow } = await supabase
        .from('ss_escrow')
        .select('id, status')
        .eq('seat_id', seatId)
        .eq('status', 'held')
        .maybeSingle();
    if (!escrow) return; // already released/refunded, or no escrow (shouldn't happen post-payment)

    const { data: openDispute } = await supabase
        .from('ss_disputes')
        .select('id')
        .eq('seat_id', seatId)
        .in('status', ['open', 'investigating'])
        .maybeSingle();
    if (openDispute) return; // frozen until the dispute resolves

    await supabase.from('ss_escrow').update({
        status: 'released',
        released_at: new Date().toISOString(),
        release_reason: reason,
    }).eq('id', escrow.id);

    await supabase.from('ss_seats').update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
    }).eq('id', seatId).is('confirmed_at', null);

    const listing = seat.ss_listings;

    await supabase.rpc('ss_increment_completed_splits', { p_host_id: listing.host_id }).catch(() => {
        // Best-effort — a missing profile row here shouldn't block the payout.
    });

    await supabase.from('ss_settlements').insert([{
        host_id: listing.host_id,
        listing_id: listing.id,
        seat_ids: [seatId],
        amount: seat.seat_base,
        status: 'pending',
    }]);

    const { data: settings } = await supabase.from('ss_platform_settings').select('insurance_pool_contribution_rate, insurance_pool_balance').eq('id', 1).single();
    const contribution = Math.round(seat.service_charge * settings.insurance_pool_contribution_rate * 100) / 100;
    if (contribution > 0) {
        await supabase.from('ss_insurance_pool_ledger').insert([{ direction: 'credit', amount: contribution, reason: 'Service charge contribution', seat_id: seatId }]);
        await supabase.from('ss_platform_settings').update({ insurance_pool_balance: settings.insurance_pool_balance + contribution }).eq('id', 1);
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
