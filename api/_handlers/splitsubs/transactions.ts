import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { parseListParams } from '../../_lib/splitsubsListQuery.js';

// GET ?page=&pageSize=&sort=&order= — every payment the signed-in user has
// ever made as a joiner (every attempt, not just successful ones — a failed
// or pending charge is still useful history), with the seat/listing/service
// context. This is "purchase history"; MySeats is seat *management* (confirm
// access, dispute, rate) — the two overlap in data but answer different
// questions, so they stay separate pages.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const user = await verifyAuth(req, res);
    if (!user) return;

    try {
        const params = parseListParams(req, { allowedSorts: ['created_at', 'amount', 'status'], defaultSort: 'created_at' });

        // ss_payments has no joiner_id of its own — it hangs off the seat, so
        // this filters via the seats the user owns first, then paginates the
        // payment rows themselves.
        const { data: seats } = await supabase.from('ss_seats').select('id').eq('joiner_id', user.id);
        const seatIds = (seats || []).map((s) => s.id);
        if (seatIds.length === 0) return res.status(200).json({ transactions: [], total: 0, page: params.page, pageSize: params.pageSize });

        const { data: payments, error, count } = await supabase
            .from('ss_payments')
            .select('*, ss_seats(id, total_paid, status, ss_listings(title, ss_services(name, category, icon_url)))', { count: 'exact' })
            .in('seat_id', seatIds)
            .order(params.sort, { ascending: params.order === 'asc' })
            .range(params.from, params.to);
        if (error) throw error;

        return res.status(200).json({ transactions: payments || [], total: count || 0, page: params.page, pageSize: params.pageSize });
    } catch (err: any) {
        console.error('splitsubs/transactions error:', err);
        return res.status(500).json({ error: 'Could not load your transactions.' });
    }
}
