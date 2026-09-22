import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { parseListParams, likeTerm } from '../../../_lib/splitsubsListQuery.js';

// A Paystack checkout row starts 'pending' the instant initializeTransaction
// is called, before the joiner has even seen Paystack's page — if they
// abandon it, Paystack never sends a webhook (there's no charge to report),
// so it sits 'pending' forever with nothing for anyone to act on. Direct
// Transfer's 'pending' is the opposite: it's exactly the state that means
// "an admin needs to review and confirm this," so it stays visible. This is
// a display filter, not a data fix — the underlying row is still 'pending'
// in the source table, just not surfaced as noise here.
const HIDDEN_PENDING_SOURCES = ['paystack', 'paystack_topup'];

// GET ?page=&pageSize=&search=&sort=&order=&kind= — every money movement on
// the platform (seat payments, prepaid wallet top-ups/spends/refunds, host
// wallet credits/debits), from ss_transaction_ledger (see schema.sql) —
// platform-wide, unscoped by user, unlike splitsubs/transactions.ts.
// `search` matches listing title OR the paying/receiving user's email
// (looked up via ss_host_profiles.email, the same cached-email pattern
// admin/splitsubs/hosts.ts already searches by). `kind` filters to one
// ledger/type exactly as returned (e.g. "seat_payment", "wallet_topup",
// "host_credit") — the admin UI exposes this as tabs.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const params = parseListParams(req, { allowedSorts: ['created_at', 'amount', 'status'], defaultSort: 'created_at' });
        const kind = String(req.query.kind || '');

        let query = supabase.from('ss_transaction_ledger').select('*', { count: 'exact' });
        if (kind) query = query.eq('kind', kind);
        query = query.or(`status.neq.pending,source.not.in.(${HIDDEN_PENDING_SOURCES.join(',')})`);

        if (params.search) {
            const { data: matchingProfiles } = await supabase
                .from('ss_host_profiles')
                .select('id')
                .ilike('email', likeTerm(params.search));
            const matchingIds = (matchingProfiles || []).map((p) => p.id);

            const orParts = [`listing_title.ilike.${likeTerm(params.search)}`, `reference.ilike.${likeTerm(params.search)}`];
            if (matchingIds.length > 0) orParts.push(`user_id.in.(${matchingIds.join(',')})`);
            query = query.or(orParts.join(','));
        }

        const { data: rows, error, count } = await query
            .order(params.sort, { ascending: params.order === 'asc' })
            .range(params.from, params.to);
        if (error) throw error;

        // Emails aren't on the view (it has no clean join target for auth.users),
        // so they're backfilled here — first from the cached column
        // admin/splitsubs/hosts.ts also relies on, then (for anyone who's never
        // touched a profile endpoint, so has no ss_host_profiles row at all —
        // e.g. this exact top-up test) a direct auth lookup per remaining id,
        // bounded to this one page's worth of distinct users.
        const userIds: string[] = Array.from(new Set((rows || []).map((r) => r.user_id).filter(Boolean)));
        const emailByUser: Record<string, string> = {};
        if (userIds.length > 0) {
            const { data: profiles } = await supabase.from('ss_host_profiles').select('id, email').in('id', userIds);
            for (const p of profiles || []) if (p.email) emailByUser[p.id] = p.email;

            const stillMissing = userIds.filter((id) => !emailByUser[id]);
            await Promise.all(stillMissing.map(async (id: string) => {
                const { data: u } = await supabase.auth.admin.getUserById(id);
                if (u?.user?.email) emailByUser[id] = u.user.email;
            }));
        }
        const enriched = (rows || []).map((r) => ({ ...r, user_email: emailByUser[r.user_id] || null }));

        return res.status(200).json({ transactions: enriched, total: count || 0, page: params.page, pageSize: params.pageSize });
    } catch (err: any) {
        console.error('admin/splitsubs/transactions error:', err);
        return res.status(500).json({ error: 'Could not load transactions.' });
    }
}
