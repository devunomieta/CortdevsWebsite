import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { computeSeatPricing } from '../../_lib/splitsubsFees.js';
import { isNonEmpty } from '../../_lib/validation.js';
import { initializeTransaction } from '../../_lib/paystack.js';
import { getPrepaidBalance } from '../../_lib/splitsubsPrepaidWallet.js';
import { finalizeSuccessfulPayment } from '../../_lib/splitsubsPayments.js';
import { getAppBaseUrl } from '../../_lib/appUrl.js';

// POST — a joiner claims a seat on a listing and starts payment. Seat claim
// itself is atomic (ss_claim_seat, row-locked against overselling). Three
// providers: Paystack and Direct Transfer both round-trip through a real
// checkout; 'wallet' (prepaid balance — splitsubs/prepaid-wallet.ts) settles
// instantly, no checkout at all, straight into finalizeSuccessfulPayment.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const joiner = await verifyAuth(req, res);
    if (!joiner) return;

    const { listingId, joinerFieldsData, provider } = req.body || {};
    if (!isNonEmpty(listingId)) return res.status(400).json({ error: 'listingId is required.' });

    try {
        const { data: listing, error: listingError } = await supabase
            .from('ss_listings')
            .select('id, title, plan_cost, total_seats, charge_rate, status, host_id, ss_services(joiner_fields)')
            .eq('id', listingId)
            .maybeSingle();
        if (listingError || !listing || listing.status !== 'active') {
            return res.status(400).json({ error: 'This listing is not open for joining.' });
        }
        if (listing.host_id === joiner.id) {
            return res.status(400).json({ error: "You can't join your own listing." });
        }

        const requiredKeys = (listing.ss_services.joiner_fields || []).filter((f: any) => f.required).map((f: any) => f.key);
        const missing = requiredKeys.filter((k: string) => !joinerFieldsData || !isNonEmpty(String(joinerFieldsData[k] ?? '')));
        if (missing.length) return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });

        const { data: settings } = await supabase.from('ss_platform_settings').select('paystack_enabled, paystack_mode, direct_transfer_enabled').eq('id', 1).single();
        const chosenProvider = provider === 'direct_transfer' ? 'direct_transfer' : provider === 'wallet' ? 'wallet' : 'paystack';
        if (chosenProvider === 'paystack' && !settings.paystack_enabled) return res.status(400).json({ error: 'Card/bank payment is temporarily unavailable — try Direct Transfer.' });
        if (chosenProvider === 'direct_transfer' && !settings.direct_transfer_enabled) return res.status(400).json({ error: 'Direct Transfer is temporarily unavailable — try Paystack.' });

        const pricing = computeSeatPricing(listing.plan_cost, listing.total_seats, listing.charge_rate);

        if (chosenProvider === 'wallet') {
            const balance = await getPrepaidBalance(joiner.id);
            if (balance < pricing.totalPaid) {
                return res.status(400).json({ error: `Your wallet balance (₦${balance.toLocaleString()}) is short of the ₦${pricing.totalPaid.toLocaleString()} needed. Top up or choose another payment method.` });
            }
        }

        const { data: seatId, error: claimError } = await supabase.rpc('ss_claim_seat', {
            p_listing_id: listing.id,
            p_joiner_id: joiner.id,
            p_joiner_fields: joinerFieldsData || {},
            p_seat_base: pricing.seatBase,
            p_service_charge: pricing.serviceCharge,
            p_total_paid: pricing.totalPaid,
        });
        if (claimError) {
            const known: Record<string, string> = {
                no_seats_open: 'All seats on this listing are taken.',
                listing_unavailable: 'This listing is not open for joining.',
                already_joined: "You've already joined this listing.",
            };
            const msg = Object.keys(known).find((k) => claimError.message?.includes(k));
            return res.status(409).json({ error: msg ? known[msg] : 'Could not claim a seat — please try again.' });
        }

        if (chosenProvider === 'wallet') {
            // Re-check right before spending — narrows (doesn't eliminate) the
            // race window against a second simultaneous wallet-funded join by
            // the same user. If it did slip through, cancel the seat we just
            // claimed rather than leave a phantom unpaid hold on it.
            const balanceNow = await getPrepaidBalance(joiner.id);
            if (balanceNow < pricing.totalPaid) {
                await supabase.from('ss_seats').update({ status: 'cancelled' }).eq('id', seatId);
                return res.status(409).json({ error: 'Your balance changed — please try again.' });
            }

            const reference = `ss_wl_${crypto.randomUUID()}`;
            await supabase.from('ss_prepaid_wallet_transactions').insert([{
                user_id: joiner.id, type: 'spend', amount: pricing.totalPaid, source: 'seat_payment', seat_id: seatId,
            }]);
            const { data: payment, error: paymentError } = await supabase.from('ss_payments').insert([{
                seat_id: seatId,
                provider: 'wallet',
                provider_reference: reference,
                amount: pricing.totalPaid,
                mode: settings.paystack_mode,
                status: 'pending',
            }]).select('id').single();
            if (paymentError) throw paymentError;

            await finalizeSuccessfulPayment(payment.id);
            return res.status(200).json({ seatId, provider: 'wallet', success: true });
        }

        if (chosenProvider === 'direct_transfer') {
            const reference = `ss_dt_${crypto.randomUUID()}`;
            await supabase.from('ss_payments').insert([{
                seat_id: seatId,
                provider: 'direct_transfer',
                provider_reference: reference,
                amount: pricing.totalPaid,
                mode: settings.paystack_mode,
                status: 'pending',
            }]);
            return res.status(200).json({ seatId, provider: 'direct_transfer', reference, amount: pricing.totalPaid });
        }

        const reference = `ss_ps_${crypto.randomUUID()}`;
        await supabase.from('ss_payments').insert([{
            seat_id: seatId,
            provider: 'paystack',
            provider_reference: reference,
            amount: pricing.totalPaid,
            mode: settings.paystack_mode,
            status: 'pending',
        }]);

        const tx = await initializeTransaction(settings.paystack_mode, {
            email: joiner.email!,
            amountKobo: Math.round(pricing.totalPaid * 100),
            reference,
            callbackUrl: `${getAppBaseUrl('https://splitsubs.cortdevs.com')}/dashboard?paystack_ref=${reference}`,
            metadata: { seatId, listingId: listing.id },
        });

        return res.status(200).json({ seatId, provider: 'paystack', authorizationUrl: tx.authorization_url, reference });
    } catch (err: any) {
        console.error('splitsubs/join error:', err);
        return res.status(500).json({ error: err.message || 'Could not start payment.' });
    }
}
