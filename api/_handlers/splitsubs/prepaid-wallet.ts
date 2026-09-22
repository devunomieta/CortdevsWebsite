import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { getPrepaidBalance } from '../../_lib/splitsubsPrepaidWallet.js';
import { initializeTransaction, verifyTransaction } from '../../_lib/paystack.js';
import { getSplitsubsAppUrl } from '../../_lib/appUrl.js';

// GET ?verifyRef=   — verify-on-redirect fallback for a top-up (same reasoning
//        as splitsubs/payments-verify.ts for seat payments — shows "funded"
//        immediately even if the webhook is a few seconds behind).
// GET (default)      — the signed-in user's prepaid balance + recent
//        top-up/spend history.
// POST { action: 'topup', amount } — starts a Paystack checkout for adding
//        funds to the balance; the top-up only counts once confirmed, either
//        here or by payments-webhook.ts's "ss_tw_"-prefixed reference branch.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = await verifyAuth(req, res);
    if (!user) return;

    if (req.method === 'GET' && req.query.verifyRef) {
        try {
            const reference = String(req.query.verifyRef);
            const { data: topup } = await supabase.from('ss_prepaid_wallet_transactions').select('*').eq('provider_reference', reference).eq('user_id', user.id).maybeSingle();
            if (!topup) return res.status(404).json({ error: 'Top-up not found.' });
            if (topup.status !== 'pending') return res.status(200).json({ status: topup.status });

            const tx = await verifyTransaction(topup.mode, reference);
            if (tx.status !== 'success') {
                if (tx.status === 'failed' || tx.status === 'abandoned') await supabase.from('ss_prepaid_wallet_transactions').update({ status: 'failed' }).eq('id', topup.id);
                return res.status(200).json({ status: tx.status });
            }
            await supabase.from('ss_prepaid_wallet_transactions').update({ status: 'success' }).eq('id', topup.id).eq('status', 'pending');
            return res.status(200).json({ status: 'success' });
        } catch (err: any) {
            console.error('splitsubs/prepaid-wallet verify error:', err);
            return res.status(500).json({ error: err.message || 'Could not verify top-up.' });
        }
    }

    if (req.method === 'GET') {
        try {
            const [balance, { data: transactions }] = await Promise.all([
                getPrepaidBalance(user.id),
                supabase.from('ss_prepaid_wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
            ]);
            return res.status(200).json({ balance, transactions: transactions || [] });
        } catch (err: any) {
            console.error('splitsubs/prepaid-wallet get error:', err);
            return res.status(500).json({ error: 'Could not load your wallet balance.' });
        }
    }

    if (req.method === 'POST') {
        const { action, amount } = req.body || {};
        if (action !== 'topup') return res.status(400).json({ error: 'Unknown action.' });

        const requested = Number(amount);
        if (!requested || requested <= 0) return res.status(400).json({ error: 'Enter a valid amount.' });

        try {
            const { data: settings } = await supabase.from('ss_platform_settings').select('paystack_mode, paystack_enabled').eq('id', 1).single();
            if (!settings.paystack_enabled) return res.status(400).json({ error: 'Top-ups are temporarily unavailable.' });

            const reference = `ss_tw_${crypto.randomUUID()}`;
            await supabase.from('ss_prepaid_wallet_transactions').insert([{
                user_id: user.id, type: 'topup', amount: requested, source: 'paystack_topup',
                provider_reference: reference, mode: settings.paystack_mode, status: 'pending',
            }]);

            const tx = await initializeTransaction(settings.paystack_mode, {
                email: user.email!,
                amountKobo: Math.round(requested * 100),
                reference,
                callbackUrl: `${getSplitsubsAppUrl()}/dashboard/transactions?topup_ref=${reference}`,
                metadata: { userId: user.id, kind: 'prepaid_topup' },
            });

            return res.status(200).json({ authorizationUrl: tx.authorization_url, reference });
        } catch (err: any) {
            console.error('splitsubs/prepaid-wallet topup error:', err);
            return res.status(500).json({ error: err.message || 'Could not start top-up.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
