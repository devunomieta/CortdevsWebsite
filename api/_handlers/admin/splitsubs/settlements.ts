import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { getWalletSummary } from '../../../_lib/splitsubsWallet.js';
import { parseListParams } from '../../../_lib/splitsubsListQuery.js';

// GET ?page=&pageSize=&search=&sort=&order= — every host with wallet
// activity, each with balance/available/locked (PRD-extension: payouts are
// host-initiated self-service withdrawals now — see splitsubs/wallet.ts —
// this is admin OVERSIGHT, not a place to trigger a payout). Grouping and
// balance math happen in-memory per host (wallet balance is computed from
// the ledger, not stored — see splitsubsWallet.ts), so pagination/search/sort
// apply to the resulting host list.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const params = parseListParams(req, { allowedSorts: ['balance', 'available', 'hostEmail'], defaultSort: 'balance' });

        const { data: rows, error } = await supabase.from('ss_wallet_transactions').select('host_id').limit(20000);
        if (error) throw error;
        const hostIds: string[] = Array.from(new Set((rows || []).map((r) => r.host_id as string)));

        let hosts = await Promise.all(hostIds.map(async (hostId: string) => {
            const [summary, { data: user }, { data: profile }] = await Promise.all([
                getWalletSummary(hostId),
                supabase.auth.admin.getUserById(hostId),
                supabase.from('ss_host_profiles').select('bank_account_name, bank_account_number, bank_code, verification_tier').eq('id', hostId).maybeSingle(),
            ]);
            return { hostId, hostEmail: user?.user?.email || '', payoutReady: Boolean(profile?.bank_account_number && profile?.bank_code), profile, ...summary };
        }));

        hosts = hosts.filter((h) => h.balance > 0 || h.available > 0);
        if (params.search) hosts = hosts.filter((h) => h.hostEmail.toLowerCase().includes(params.search.toLowerCase()));
        hosts.sort((a, b) => {
            const cmp = params.sort === 'hostEmail' ? a.hostEmail.localeCompare(b.hostEmail) : (a as any)[params.sort] - (b as any)[params.sort];
            return params.order === 'asc' ? cmp : -cmp;
        });

        const total = hosts.length;
        const pageItems = hosts.slice(params.from, params.to + 1);

        return res.status(200).json({ hosts: pageItems, total, page: params.page, pageSize: params.pageSize });
    } catch (err: any) {
        console.error('admin/splitsubs/settlements get error:', err);
        return res.status(500).json({ error: 'Could not load wallet balances.' });
    }
}
