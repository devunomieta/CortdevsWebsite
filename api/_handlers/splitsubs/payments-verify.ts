import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { verifyTransaction } from '../../_lib/paystack.js';
import { finalizeSuccessfulPayment } from '../../_lib/splitsubsPayments.js';

// GET ?reference= — fallback confirmation path for the post-checkout redirect,
// so a joiner sees "paid" immediately even if the webhook is a few seconds
// behind. Re-verifies against Paystack directly rather than trusting the
// redirect query string; idempotent with the webhook via finalizeSuccessfulPayment.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const joiner = await verifyAuth(req, res);
    if (!joiner) return;

    const reference = String(req.query.reference || '');
    if (!reference) return res.status(400).json({ error: 'reference is required.' });

    try {
        const { data: payment } = await supabase
            .from('ss_payments')
            .select('id, status, mode, seat_id, ss_seats(joiner_id)')
            .eq('provider', 'paystack')
            .eq('provider_reference', reference)
            .maybeSingle();
        if (!payment) return res.status(404).json({ error: 'Payment not found.' });
        if (payment.ss_seats.joiner_id !== joiner.id) return res.status(403).json({ error: 'Not your payment.' });

        if (payment.status === 'success') return res.status(200).json({ status: 'success' });

        const tx = await verifyTransaction(payment.mode, reference);
        if (tx.status !== 'success') {
            if (tx.status === 'failed' || tx.status === 'abandoned') {
                await supabase.from('ss_payments').update({ status: 'failed' }).eq('id', payment.id);
            }
            return res.status(200).json({ status: tx.status });
        }

        await finalizeSuccessfulPayment(payment.id);
        return res.status(200).json({ status: 'success' });
    } catch (err: any) {
        console.error('splitsubs/payments-verify error:', err);
        return res.status(500).json({ error: err.message || 'Could not verify payment.' });
    }
}
