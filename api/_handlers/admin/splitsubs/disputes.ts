import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { createRefund } from '../../../_lib/paystack.js';
import { releaseEscrowForSeat } from '../../../_lib/splitsubsPayments.js';
import { logSplitsubsActivity } from '../../../_lib/splitsubsAuditLog.js';
import { sendDisputeUpdate } from '../../../_lib/splitsubsEmail.js';
import { withinLength, LIMITS } from '../../../_lib/validation.js';
import { parseListParams, likeTerm } from '../../../_lib/splitsubsListQuery.js';

// GET ?filter=open|resolved|all&page=&pageSize=&search=&sort=&order= — dispute
//     queue with seat/listing/party context (PRD "Dispute & resolution
//     center — queue with full transaction context"), paginated/searchable
//     (by reason)/sortable. `filter` defaults to 'open' (open + investigating).
// PATCH { id, resolution, notes } — resolution: 'resolved_refund' (host-caused
//        failure: refund the joiner via Paystack, strike the host) |
//        'resolved_release' (dispute unfounded: release escrow as normal) |
//        'dismissed' (closed with no money movement, e.g. duplicate report).
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        try {
            const filter = String(req.query.filter || 'open');
            const params = parseListParams(req, { allowedSorts: ['created_at', 'status'], defaultSort: 'created_at' });
            let query = supabase
                .from('ss_disputes')
                .select('*, ss_seats(id, total_paid, status, ss_listings(id, title, host_id))', { count: 'exact' });
            if (filter === 'open') query = query.in('status', ['open', 'investigating']);
            else if (filter === 'resolved') query = query.in('status', ['resolved_refund', 'resolved_release', 'dismissed']);
            if (params.search) query = query.ilike('reason', likeTerm(params.search));
            const { data: disputes, error, count } = await query.order(params.sort, { ascending: params.order === 'asc' }).range(params.from, params.to);
            if (error) throw error;
            return res.status(200).json({ disputes: disputes || [], total: count || 0, page: params.page, pageSize: params.pageSize });
        } catch (err: any) {
            console.error('admin/splitsubs/disputes get error:', err);
            return res.status(500).json({ error: 'Could not load disputes.' });
        }
    }

    if (req.method === 'PATCH') {
        const { id, resolution, notes } = req.body || {};
        if (!id || !resolution) return res.status(400).json({ error: 'id and resolution are required.' });
        if (!['resolved_refund', 'resolved_release', 'dismissed'].includes(resolution)) return res.status(400).json({ error: 'Invalid resolution.' });
        if (notes && !withinLength(notes, LIMITS.message)) return res.status(400).json({ error: `Notes must be ${LIMITS.message} characters or fewer.` });

        try {
            const { data: dispute } = await supabase
                .from('ss_disputes')
                .select('*, ss_seats(id, joiner_id, total_paid, ss_listings(id, title, host_id))')
                .eq('id', id)
                .maybeSingle();
            if (!dispute) return res.status(404).json({ error: 'Dispute not found.' });
            if (dispute.status !== 'open' && dispute.status !== 'investigating') return res.status(400).json({ error: 'This dispute is already resolved.' });

            const seat = dispute.ss_seats;
            const listing = seat.ss_listings;

            await supabase.from('ss_disputes').update({
                status: resolution, resolution_notes: notes || null, resolved_by: admin.id, resolved_at: new Date().toISOString(),
            }).eq('id', id);

            if (resolution === 'resolved_refund') {
                const { data: payment } = await supabase.from('ss_payments').select('*').eq('seat_id', seat.id).eq('status', 'success').order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (payment?.provider === 'paystack') {
                    await createRefund(payment.mode, { transactionReference: payment.provider_reference, reason: notes || 'SplitSubs dispute resolution' }).catch((e) => {
                        console.error('Paystack refund failed — falling through to manual reconciliation:', e.message);
                    });
                }
                await supabase.from('ss_escrow').update({ status: 'refunded', released_at: new Date().toISOString(), release_reason: 'dispute_resolved_refund' }).eq('seat_id', seat.id).eq('status', 'held');
                await supabase.from('ss_seats').update({ status: 'refunded' }).eq('id', seat.id);
                const { data: hostProfile } = await supabase.from('ss_host_profiles').select('strikes').eq('id', listing.host_id).maybeSingle();
                await supabase.from('ss_host_profiles').upsert([{ id: listing.host_id, strikes: (hostProfile?.strikes || 0) + 1 }], { onConflict: 'id' });

                // If escrow had already released before the dispute landed (seat was
                // 'confirmed'), the host's wallet was already credited for it — claw
                // that credit back with an offsetting debit so a refunded joiner can
                // never coexist with the host still holding that money.
                const { data: priorCredit } = await supabase
                    .from('ss_wallet_transactions')
                    .select('amount')
                    .eq('seat_id', seat.id)
                    .eq('type', 'credit')
                    .eq('source', 'escrow_release')
                    .maybeSingle();
                if (priorCredit) {
                    await supabase.from('ss_wallet_transactions').insert([{
                        host_id: listing.host_id,
                        type: 'debit',
                        amount: priorCredit.amount,
                        source: 'dispute_reversal',
                        seat_id: seat.id,
                        listing_id: listing.id,
                        reason: `Dispute resolved in the joiner's favor: ${notes || 'no notes'}`,
                    }]);
                }
            } else if (resolution === 'resolved_release') {
                await releaseEscrowForSeat(seat.id, 'dispute_resolved_release');
            }
            // 'dismissed' — the dispute record itself already unblocks releaseEscrowForSeat's
            // open-dispute check on its next run (cron or joiner confirm); no direct action.

            const [{ data: joinerUser }, { data: hostUser }] = await Promise.all([
                supabase.auth.admin.getUserById(seat.joiner_id),
                supabase.auth.admin.getUserById(listing.host_id),
            ]);
            for (const email of [joinerUser?.user?.email, hostUser?.user?.email]) {
                if (email) await sendDisputeUpdate(email, { listingTitle: listing.title, status: resolution, note: notes }).catch((e) => console.error(e));
            }

            await logSplitsubsActivity({
                actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`,
                action: `Resolved dispute (${resolution}) on "${listing.title}"`, targetType: 'dispute', targetId: id,
            });

            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('admin/splitsubs/disputes patch error:', err);
            return res.status(500).json({ error: err.message || 'Could not resolve dispute.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
