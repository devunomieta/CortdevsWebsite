import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { parseListParams } from '../../_lib/splitsubsListQuery.js';

// GET ?page=&pageSize=&sort=&order= — every seat the signed-in user has
// joined, with the listing/service context and, once access has been
// granted, the access note the host left (Joiner dashboard: "Secure access
// panel... revealed only after payment confirmed"), paginated/sortable.
// No `search`: the searchable text (service/listing name) lives on a joined
// table PostgREST can't filter from this side without a dedicated view —
// a personal seat list is small enough that this doesn't bite in practice.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const joiner = await verifyAuth(req, res);
    if (!joiner) return;

    try {
        const params = parseListParams(req, { allowedSorts: ['created_at', 'status'], defaultSort: 'created_at' });
        const { data: seats, error, count } = await supabase
            .from('ss_seats')
            .select('*, ss_listings(id, title, renewal_day, next_renewal_date, ss_services(name, category, icon_url))', { count: 'exact' })
            .eq('joiner_id', joiner.id)
            .order(params.sort, { ascending: params.order === 'asc' })
            .range(params.from, params.to);
        if (error) throw error;

        // access_note only makes sense once access has actually been granted —
        // strip it for any earlier status so the API never leaks it prematurely.
        const sanitized = (seats || []).map((s) => ({
            ...s,
            access_note: ['access_pending', 'confirmed'].includes(s.status) ? s.access_note : null,
        }));

        return res.status(200).json({ seats: sanitized, total: count || 0, page: params.page, pageSize: params.pageSize });
    } catch (err: any) {
        console.error('splitsubs/my-seats error:', err);
        return res.status(500).json({ error: 'Could not load your subscriptions.' });
    }
}
