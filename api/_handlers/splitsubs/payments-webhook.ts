import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyWebhookSignature } from '../../_lib/paystack.js';
import { finalizeSuccessfulPayment } from '../../_lib/splitsubsPayments.js';

// POST — Paystack webhook. router.ts captures the raw request body onto
// req.rawBody before JSON-parsing it into req.body (see router.ts), because
// signature verification must run against the exact bytes Paystack sent, not
// a re-serialized copy of the parsed object.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const rawBody: string = (req as any).rawBody || JSON.stringify(req.body || {});
    const mode = verifyWebhookSignature(rawBody, req.headers['x-paystack-signature'] as string | undefined);
    if (!mode) {
        console.warn('splitsubs/payments-webhook: signature verification failed');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;

    try {
        if (event.event === 'charge.success') {
            const reference = event.data?.reference;
            const { data: payment } = await supabase.from('ss_payments').select('id, status').eq('provider', 'paystack').eq('provider_reference', reference).maybeSingle();
            if (payment && payment.status === 'pending') {
                await finalizeSuccessfulPayment(payment.id);
            }
        }

        if (event.event === 'transfer.success' || event.event === 'transfer.failed') {
            const transferCode = event.data?.transfer_code;
            const status = event.event === 'transfer.success' ? 'paid' : 'failed';
            await supabase
                .from('ss_settlements')
                .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null, failure_reason: status === 'failed' ? event.data?.reason || 'Transfer failed' : null })
                .eq('paystack_transfer_code', transferCode);
        }

        return res.status(200).json({ received: true });
    } catch (err: any) {
        console.error('splitsubs/payments-webhook error:', err);
        // Still 200 — Paystack retries on non-2xx, and we've logged it; a
        // stuck 'pending' payment is caught by the verify-on-redirect
        // fallback or manual admin reconciliation either way.
        return res.status(200).json({ received: true, warning: 'processing error logged' });
    }
}
