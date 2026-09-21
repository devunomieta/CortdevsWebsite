import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { logSplitsubsActivity } from '../../../_lib/splitsubsAuditLog.js';
import { parseListParams, likeTerm } from '../../../_lib/splitsubsListQuery.js';

// GET ?status=pending_review&page=&pageSize=&search=&sort=&order= — moderation
//     queue (defaults to pending_review), paginated/searchable/sortable.
// GET ?id=                     — one listing's full detail (proof, host fields, seats).
// PATCH { id, action }         — action: 'approve' | 'reject' | 'suspend'.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET' && req.query.id) {
        try {
            const { data: listing, error } = await supabase
                .from('ss_listings')
                .select('*, ss_services(name, category, host_fields, joiner_fields, risk_tier)')
                .eq('id', String(req.query.id))
                .maybeSingle();
            if (error || !listing) return res.status(404).json({ error: 'Listing not found.' });

            const [{ data: seats }, { data: host }] = await Promise.all([
                supabase.from('ss_seats').select('*').eq('listing_id', listing.id),
                supabase.auth.admin.getUserById(listing.host_id),
            ]);

            return res.status(200).json({ listing: { ...listing, hostEmail: host?.user?.email }, seats: seats || [] });
        } catch (err: any) {
            console.error('admin/splitsubs/listings get error:', err);
            return res.status(500).json({ error: 'Could not load listing.' });
        }
    }

    if (req.method === 'GET') {
        try {
            const status = String(req.query.status || 'pending_review');
            const params = parseListParams(req, { allowedSorts: ['created_at', 'plan_cost', 'total_seats', 'title'], defaultSort: 'created_at' });
            let query = supabase
                .from('ss_listings')
                .select('id, title, plan_cost, total_seats, status, created_at, host_id, ss_services(name)', { count: 'exact' })
                .eq('status', status);
            if (params.search) query = query.ilike('title', likeTerm(params.search));
            const { data: listings, error, count } = await query.order(params.sort, { ascending: params.order === 'asc' }).range(params.from, params.to);
            if (error) throw error;
            return res.status(200).json({ listings: listings || [], total: count || 0, page: params.page, pageSize: params.pageSize });
        } catch (err: any) {
            console.error('admin/splitsubs/listings list error:', err);
            return res.status(500).json({ error: 'Could not load listings.' });
        }
    }

    if (req.method === 'PATCH') {
        const { id, action, rejectionReason } = req.body || {};
        if (!id || !action) return res.status(400).json({ error: 'id and action are required.' });

        try {
            const { data: listing } = await supabase.from('ss_listings').select('id, title, status').eq('id', id).maybeSingle();
            if (!listing) return res.status(404).json({ error: 'Listing not found.' });

            let patch: Record<string, unknown>;
            if (action === 'approve') {
                patch = { status: 'active', approved_by: admin.id, approved_at: new Date().toISOString() };
            } else if (action === 'reject') {
                patch = { status: 'rejected', rejection_reason: rejectionReason || 'Did not meet listing requirements.' };
            } else if (action === 'suspend') {
                patch = { status: 'suspended', rejection_reason: rejectionReason || null };
            } else {
                return res.status(400).json({ error: 'Unknown action.' });
            }

            const { error } = await supabase.from('ss_listings').update(patch).eq('id', id);
            if (error) throw error;

            await logSplitsubsActivity({ actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`, action: `${action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Suspended'} listing "${listing.title}"`, targetType: 'listing', targetId: id });
            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('admin/splitsubs/listings patch error:', err);
            return res.status(500).json({ error: err.message || 'Could not update listing.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
