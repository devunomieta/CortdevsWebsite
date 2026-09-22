import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { parseListParams } from '../../_lib/splitsubsListQuery.js';

// A Paystack checkout row starts 'pending' the instant initializeTransaction
// is called, before the user has even seen Paystack's page — if they abandon
// it, Paystack never sends a webhook (there's no charge to report), so it
// sits 'pending' forever with nothing for anyone to act on, and it's just
// clutter here. Direct Transfer's 'pending' is the opposite — it's exactly
// the state that means "waiting on an admin to confirm this," so it stays
// visible (also shown, more prominently, on My Seats/Wallet already).
const HIDDEN_PENDING_SOURCES = ['paystack', 'paystack_topup'];

// GET ?page=&pageSize=&sort=&order= — every money movement tied to the
// signed-in user, whichever ledger it actually lives in: seat payments
// (every attempt, not just successful ones — a failed/pending charge is
// still useful history), prepaid wallet top-ups/spends/refunds, and — for a
// host — their earnings-wallet credits/debits. Reads from
// ss_transaction_ledger (see schema.sql) rather than ss_payments alone, which
// is what previously let a wallet top-up correctly credit the balance
// (PrepaidWalletCard) while never actually showing up in this list. This is
// "purchase/money history"; MySeats is seat *management* (confirm access,
// dispute, rate) — the two overlap in data but answer different questions,
// so they stay separate pages.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const user = await verifyAuth(req, res);
    if (!user) return;

    try {
        const params = parseListParams(req, { allowedSorts: ['created_at', 'amount', 'status'], defaultSort: 'created_at' });

        const { data: transactions, error, count } = await supabase
            .from('ss_transaction_ledger')
            .select('*', { count: 'exact' })
            .eq('user_id', user.id)
            .or(`status.neq.pending,source.not.in.(${HIDDEN_PENDING_SOURCES.join(',')})`)
            .order(params.sort, { ascending: params.order === 'asc' })
            .range(params.from, params.to);
        if (error) throw error;

        return res.status(200).json({ transactions: transactions || [], total: count || 0, page: params.page, pageSize: params.pageSize });
    } catch (err: any) {
        console.error('splitsubs/transactions error:', err);
        return res.status(500).json({ error: 'Could not load your transactions.' });
    }
}
