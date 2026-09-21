import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { computeSeatPricing } from '../../_lib/splitsubsFees.js';
import { logSplitsubsActivity } from '../../_lib/splitsubsAuditLog.js';
import { parseListParams, likeTerm } from '../../_lib/splitsubsListQuery.js';

// GET ?page=&pageSize=&search=&sort=&order= — the signed-in user's own
// listings, each with its seats and pricing (Host dashboard: "Manage active
// listings" / "seats filled/open, per-joiner status"), paginated/searchable
// (by title)/sortable.
// PATCH { id, status: 'paused'|'active', renewalDay? } — a host can pause/resume
// their own listing or adjust the renewal day; suspend/reject stays admin-only
// (admin/splitsubs/listings.ts).
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const host = await verifyAuth(req, res);
    if (!host) return;

    if (req.method === 'GET') {
        try {
            const params = parseListParams(req, { allowedSorts: ['created_at', 'plan_cost', 'status'], defaultSort: 'created_at' });
            let query = supabase
                .from('ss_listings')
                .select('*, ss_services(name, category, icon_url)', { count: 'exact' })
                .eq('host_id', host.id);
            if (params.search) query = query.ilike('title', likeTerm(params.search));
            const { data: listings, error, count } = await query.order(params.sort, { ascending: params.order === 'asc' }).range(params.from, params.to);
            if (error) throw error;

            const ids = (listings || []).map((l) => l.id);
            const { data: seats } = await supabase
                .from('ss_seats')
                .select('*')
                .in('listing_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
                .order('created_at', { ascending: true });

            const seatsByListing = new Map<string, any[]>();
            (seats || []).forEach((s) => {
                if (!seatsByListing.has(s.listing_id)) seatsByListing.set(s.listing_id, []);
                seatsByListing.get(s.listing_id)!.push(s);
            });

            const enriched = (listings || []).map((l) => ({
                ...l,
                pricing: computeSeatPricing(l.plan_cost, l.total_seats, l.charge_rate),
                seats: seatsByListing.get(l.id) || [],
            }));

            return res.status(200).json({ listings: enriched, total: count || 0, page: params.page, pageSize: params.pageSize });
        } catch (err: any) {
            console.error('splitsubs/host-listings get error:', err);
            return res.status(500).json({ error: 'Could not load your listings.' });
        }
    }

    if (req.method === 'PATCH') {
        const { id, status, renewalDay } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id is required.' });

        try {
            const { data: listing } = await supabase.from('ss_listings').select('id, host_id, status, title').eq('id', id).maybeSingle();
            if (!listing || listing.host_id !== host.id) return res.status(404).json({ error: 'Listing not found.' });

            const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (status) {
                if (!['paused', 'active'].includes(status)) return res.status(400).json({ error: 'Hosts can only pause or resume a listing.' });
                if (status === 'active' && listing.status !== 'paused') return res.status(400).json({ error: 'Only a paused listing can be resumed here.' });
                patch.status = status;
            }
            if (renewalDay !== undefined) {
                if (renewalDay !== null && (Number(renewalDay) < 1 || Number(renewalDay) > 28)) return res.status(400).json({ error: 'renewalDay must be between 1 and 28.' });
                patch.renewal_day = renewalDay;
            }

            const { error } = await supabase.from('ss_listings').update(patch).eq('id', id);
            if (error) throw error;

            await logSplitsubsActivity({
                actorType: 'host', actorId: host.id, actorLabel: `Host — ${host.email}`,
                action: `Updated listing "${listing.title}"${status ? ` → ${status}` : ''}`, targetType: 'listing', targetId: id,
            });

            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('splitsubs/host-listings patch error:', err);
            return res.status(500).json({ error: err.message || 'Could not update listing.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
