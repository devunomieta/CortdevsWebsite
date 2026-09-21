import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { computeSeatPricing } from '../../_lib/splitsubsFees.js';
import { isNonEmpty, withinLength, LIMITS } from '../../_lib/validation.js';
import { logSplitsubsActivity } from '../../_lib/splitsubsAuditLog.js';
import { parseListParams } from '../../_lib/splitsubsListQuery.js';

// GET ?id=          — one listing's public detail (service + open-seat count).
// GET (no id)        — public browse: ?service=&maxPrice=&page=&pageSize=&search=&sort=&order=.
//     Whether a seat is "open" only exists after joining seat counts in memory
//     (see below), so pagination/sort/filter here run on that in-memory list —
//     fine at MVP scale (capped at the 500 newest active listings); a
//     materialized open-seat column + trigger would be the fix once volume
//     makes that cap bite.
// POST                — a host creates a listing (goes to pending_review).
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET' && req.query.id) {
        try {
            const { data: listing, error } = await supabase
                .from('ss_listings')
                .select('id, title, plan_cost, total_seats, charge_rate, status, created_at, host_id, ss_services(id, name, category, icon_url, joiner_fields, risk_tier)')
                .eq('id', String(req.query.id))
                .maybeSingle();
            if (error || !listing) return res.status(404).json({ error: 'Listing not found.' });

            const { count: takenCount } = await supabase
                .from('ss_seats')
                .select('id', { count: 'exact', head: true })
                .eq('listing_id', listing.id)
                .not('status', 'in', '(cancelled,refunded,churned)');

            const [{ data: hostProfile }, { data: hostUser }] = await Promise.all([
                supabase.from('ss_host_profiles').select('verification_tier, rating_sum, rating_count, completed_splits').eq('id', listing.host_id).maybeSingle(),
                supabase.auth.admin.getUserById(listing.host_id),
            ]);

            const pricing = computeSeatPricing(listing.plan_cost, listing.total_seats, listing.charge_rate);
            const openSeats = listing.total_seats - 1 - (takenCount || 0);

            return res.status(200).json({
                listing: {
                    ...listing,
                    openSeats: Math.max(openSeats, 0),
                    pricing,
                    host: {
                        displayName: hostProfile ? undefined : hostUser?.user?.email?.split('@')[0],
                        verificationTier: hostProfile?.verification_tier || 'basic',
                        rating: hostProfile && hostProfile.rating_count > 0 ? Math.round((hostProfile.rating_sum / hostProfile.rating_count) * 10) / 10 : null,
                        completedSplits: hostProfile?.completed_splits || 0,
                    },
                },
            });
        } catch (err: any) {
            console.error('splitsubs/listings get error:', err);
            return res.status(500).json({ error: 'Could not load listing.' });
        }
    }

    if (req.method === 'GET') {
        try {
            const params = parseListParams(req, { allowedSorts: ['created_at', 'price'], defaultSort: 'created_at' });

            let query = supabase
                .from('ss_listings')
                .select('id, title, plan_cost, total_seats, charge_rate, created_at, ss_services(id, name, category, icon_url)')
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(500);
            if (req.query.service) query = query.eq('service_id', String(req.query.service));
            if (params.search) query = query.ilike('title', `%${params.search.replace(/[%_]/g, (c) => `\\${c}`)}%`);
            const { data: listings, error } = await query;
            if (error) throw error;

            const ids = (listings || []).map((l) => l.id);
            const { data: seatRows } = await supabase
                .from('ss_seats')
                .select('listing_id')
                .in('listing_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
                .not('status', 'in', '(cancelled,refunded,churned)');

            const takenByListing = new Map<string, number>();
            (seatRows || []).forEach((s) => takenByListing.set(s.listing_id, (takenByListing.get(s.listing_id) || 0) + 1));

            const enriched = (listings || [])
                .map((l) => {
                    const pricing = computeSeatPricing(l.plan_cost, l.total_seats, l.charge_rate);
                    const openSeats = Math.max(l.total_seats - 1 - (takenByListing.get(l.id) || 0), 0);
                    return { ...l, pricing, openSeats };
                })
                .filter((l) => l.openSeats > 0)
                .filter((l) => !req.query.maxPrice || l.pricing.totalPaid <= Number(req.query.maxPrice));

            if (params.sort === 'price') {
                enriched.sort((a, b) => params.order === 'asc' ? a.pricing.totalPaid - b.pricing.totalPaid : b.pricing.totalPaid - a.pricing.totalPaid);
            } else if (params.order === 'asc') {
                enriched.reverse(); // already newest-first from the query; asc = oldest-first
            }

            const total = enriched.length;
            const pageItems = enriched.slice(params.from, params.to + 1);

            return res.status(200).json({ listings: pageItems, total, page: params.page, pageSize: params.pageSize });
        } catch (err: any) {
            console.error('splitsubs/listings browse error:', err);
            return res.status(500).json({ error: 'Could not load listings.' });
        }
    }

    if (req.method === 'POST') {
        const host = await verifyAuth(req, res);
        if (!host) return;

        const { serviceId, title, planCost, totalSeats, proofUrl, hostFieldsData, renewalDay } = req.body || {};
        if (!isNonEmpty(serviceId) || !isNonEmpty(title) || !planCost || !totalSeats) {
            return res.status(400).json({ error: 'serviceId, title, planCost, and totalSeats are required.' });
        }
        if (!withinLength(title, LIMITS.title)) return res.status(400).json({ error: `Title must be ${LIMITS.title} characters or fewer.` });
        if (Number(planCost) <= 0) return res.status(400).json({ error: 'planCost must be greater than zero.' });
        if (renewalDay && (Number(renewalDay) < 1 || Number(renewalDay) > 28)) {
            return res.status(400).json({ error: 'renewalDay must be between 1 and 28.' });
        }

        try {
            const { data: service, error: serviceError } = await supabase
                .from('ss_services')
                .select('id, max_seats, default_charge_rate, status, host_fields')
                .eq('id', serviceId)
                .maybeSingle();
            if (serviceError || !service || service.status !== 'active') {
                return res.status(400).json({ error: 'That service is not available for listing.' });
            }
            if (Number(totalSeats) < 2 || Number(totalSeats) > service.max_seats) {
                return res.status(400).json({ error: `totalSeats must be between 2 and ${service.max_seats} for this service.` });
            }

            const requiredKeys = (service.host_fields || []).filter((f: any) => f.required).map((f: any) => f.key);
            const missing = requiredKeys.filter((k: string) => !hostFieldsData || !isNonEmpty(String(hostFieldsData[k] ?? '')));
            if (missing.length) return res.status(400).json({ error: `Missing required host field(s): ${missing.join(', ')}` });

            const { data: listing, error } = await supabase
                .from('ss_listings')
                .insert([{
                    host_id: host.id,
                    service_id: serviceId,
                    title: title.trim(),
                    plan_cost: Number(planCost),
                    total_seats: Number(totalSeats),
                    charge_rate: service.default_charge_rate,
                    proof_url: proofUrl || null,
                    host_fields_data: hostFieldsData || {},
                    renewal_day: renewalDay ? Number(renewalDay) : null,
                    status: 'pending_review',
                }])
                .select('id')
                .single();
            if (error) throw error;

            // Merge-upsert (no ignoreDuplicates) so a profile created before this
            // column existed still gets its email backfilled on the next listing.
            await supabase.from('ss_host_profiles').upsert([{ id: host.id, email: host.email }], { onConflict: 'id' });

            await logSplitsubsActivity({
                actorType: 'host',
                actorId: host.id,
                actorLabel: `Host — ${host.email}`,
                action: `Created listing "${title}" (pending review)`,
                targetType: 'listing',
                targetId: listing.id,
            });

            return res.status(200).json({ id: listing.id });
        } catch (err: any) {
            console.error('splitsubs/listings create error:', err);
            return res.status(500).json({ error: err.message || 'Could not create listing.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
