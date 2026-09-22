import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { logSplitsubsActivity } from '../../../_lib/splitsubsAuditLog.js';
import { parseListParams, likeTerm } from '../../../_lib/splitsubsListQuery.js';
import { sendListingApprovedToHost, sendListingRejectedToHost, sendListingSuspendedToHost } from '../../../_lib/splitsubsEmail.js';
import { getSplitsubsAppUrl } from '../../../_lib/appUrl.js';

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
                .select('id, short_id, title, short_description, plan_cost, total_seats, status, created_at, sub_start_date, next_renewal_date, proof_url, rejection_reason, host_id, host_fields_data, ss_services(name, category, icon_url, host_fields, risk_tier, access_type)', { count: 'exact' })
                .eq('status', status);
            if (params.search) query = query.ilike('title', likeTerm(params.search));
            const { data: listings, error, count } = await query.order(params.sort, { ascending: params.order === 'asc' }).range(params.from, params.to);
            if (error) throw error;

            // Reviewing a listing means judging the host, not just the plan —
            // so the queue carries their email rather than making an admin
            // open a second tab to look it up.
            const uniqueHostIds = Array.from(new Set((listings || []).map((l) => l.host_id))) as string[];
            const hostEmails = new Map<string, string>();
            // One bad/deleted host_id shouldn't 500 the whole queue — each
            // lookup fails on its own, the row just shows no host email.
            await Promise.all(uniqueHostIds.map(async (hostId: string) => {
                try {
                    const { data } = await supabase.auth.admin.getUserById(hostId);
                    if (data?.user?.email) hostEmails.set(hostId, data.user.email);
                } catch (e) {
                    console.error(`Could not resolve host email for ${hostId}:`, e);
                }
            }));
            const enriched = (listings || []).map((l) => ({ ...l, hostEmail: hostEmails.get(l.host_id) || null }));

            return res.status(200).json({ listings: enriched, total: count || 0, page: params.page, pageSize: params.pageSize });
        } catch (err: any) {
            console.error('admin/splitsubs/listings list error:', err);
            return res.status(500).json({ error: 'Could not load listings.' });
        }
    }

    if (req.method === 'PATCH') {
        const { id, action, rejectionReason } = req.body || {};
        if (!id || !action) return res.status(400).json({ error: 'id and action are required.' });

        try {
            const { data: listing } = await supabase.from('ss_listings').select('id, title, short_id, host_id, status, ss_services(name)').eq('id', id).maybeSingle();
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

            supabase.auth.admin.getUserById(listing.host_id).then(({ data: hostUser }) => {
                const hostEmail = hostUser?.user?.email;
                if (!hostEmail) return;
                const serviceName = (listing.ss_services as any)?.name || listing.title;
                if (action === 'approve') {
                    sendListingApprovedToHost(hostEmail, { listingTitle: listing.title, serviceName, shortId: listing.short_id, listingUrl: `${getSplitsubsAppUrl()}/listing/${id}` }).catch((e) => console.error('sendListingApprovedToHost failed:', e));
                } else if (action === 'reject') {
                    sendListingRejectedToHost(hostEmail, { listingTitle: listing.title, serviceName, shortId: listing.short_id, reason: String(patch.rejection_reason), dashboardUrl: `${getSplitsubsAppUrl()}/dashboard/listings` }).catch((e) => console.error('sendListingRejectedToHost failed:', e));
                } else if (action === 'suspend') {
                    sendListingSuspendedToHost(hostEmail, { listingTitle: listing.title, serviceName, shortId: listing.short_id, reason: rejectionReason || undefined, dashboardUrl: `${getSplitsubsAppUrl()}/dashboard/listings` }).catch((e) => console.error('sendListingSuspendedToHost failed:', e));
                }
            }).catch((e) => console.error('Could not resolve host email for listing notification:', e));

            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('admin/splitsubs/listings patch error:', err);
            return res.status(500).json({ error: err.message || 'Could not update listing.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
