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
                .select('id, short_id, title, short_description, plan_cost, total_seats, charge_rate, status, created_at, sub_start_date, next_renewal_date, host_id, ss_services(id, name, category, icon_url, joiner_fields, risk_tier)')
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
            // % saved vs paying the whole plan alone — the plan cost is what
            // a solo subscriber pays; totalPaid is what a seat costs split.
            const pctSaved = listing.plan_cost > 0 ? Math.round((1 - pricing.totalPaid / listing.plan_cost) * 100) : 0;

            return res.status(200).json({
                listing: {
                    ...listing,
                    openSeats: Math.max(openSeats, 0),
                    pricing,
                    pctSaved,
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
                .select('id, short_id, title, short_description, plan_cost, total_seats, charge_rate, created_at, next_renewal_date, host_id, ss_services(id, name, category, icon_url)')
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(500);
            if (req.query.service) query = query.eq('service_id', String(req.query.service));
            if (params.search) query = query.ilike('title', `%${params.search.replace(/[%_]/g, (c) => `\\${c}`)}%`);
            const { data: listingsRaw, error } = await query;
            if (error) throw error;
            // Category filtering happens here, not via the query builder —
            // it's a column on the joined ss_services row, and this dataset
            // is already small enough (500-row cap) that filtering in JS
            // alongside the existing openSeats/maxPrice filtering below is
            // simpler than a subquery.
            const listings = req.query.category
                ? (listingsRaw || []).filter((l: any) => l.ss_services?.category === String(req.query.category))
                : listingsRaw;

            // Categories AND services with at least one active listing right
            // now — not everything the catalog knows about. A dedicated,
            // always-unfiltered query (not listingsRaw, which the service_id
            // filter above already narrows) so picking one filter doesn't
            // collapse the other's chip list down to just the selection.
            const { data: facetRows } = await supabase
                .from('ss_listings')
                .select('ss_services(id, name, category, icon_url)')
                .eq('status', 'active')
                .limit(500);
            const availableCategories = Array.from(new Set((facetRows || []).map((l: any) => l.ss_services?.category).filter(Boolean))).sort();
            const servicesById = new Map<string, { id: string; name: string; category: string; icon_url: string | null }>();
            (facetRows || []).forEach((l: any) => { if (l.ss_services && !servicesById.has(l.ss_services.id)) servicesById.set(l.ss_services.id, l.ss_services); });
            const availableServices = Array.from(servicesById.values()).sort((a, b) => a.name.localeCompare(b.name));

            const ids = (listings || []).map((l) => l.id);
            const hostIds = Array.from(new Set((listings || []).map((l) => l.host_id)));
            const [{ data: seatRows }, { data: hostProfiles }] = await Promise.all([
                supabase.from('ss_seats').select('listing_id').in('listing_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']).not('status', 'in', '(cancelled,refunded,churned)'),
                supabase.from('ss_host_profiles').select('id, rating_sum, rating_count').in('id', hostIds.length ? hostIds : ['00000000-0000-0000-0000-000000000000']),
            ]);

            const takenByListing = new Map<string, number>();
            (seatRows || []).forEach((s) => takenByListing.set(s.listing_id, (takenByListing.get(s.listing_id) || 0) + 1));
            const ratingByHost = new Map<string, number | null>();
            (hostProfiles || []).forEach((p) => ratingByHost.set(p.id, p.rating_count > 0 ? Math.round((p.rating_sum / p.rating_count) * 10) / 10 : null));

            const enriched = (listings || [])
                .map((l) => {
                    const pricing = computeSeatPricing(l.plan_cost, l.total_seats, l.charge_rate);
                    const openSeats = Math.max(l.total_seats - 1 - (takenByListing.get(l.id) || 0), 0);
                    const pctSaved = l.plan_cost > 0 ? Math.round((1 - pricing.totalPaid / l.plan_cost) * 100) : 0;
                    return { ...l, pricing, openSeats, pctSaved, hostRating: ratingByHost.get(l.host_id) ?? null };
                })
                // Sold-out listings used to be filtered out here entirely —
                // Feature Audit doc, Phase 3: that's a direct blocker for
                // "notify me" (nowhere to click it from if the listing never
                // shows), so they now stay in results, badged Sold Out on
                // the frontend, sorted to the end regardless of sort order.
                .filter((l) => !req.query.maxPrice || l.pricing.totalPaid <= Number(req.query.maxPrice));

            if (params.sort === 'price') {
                enriched.sort((a, b) => params.order === 'asc' ? a.pricing.totalPaid - b.pricing.totalPaid : b.pricing.totalPaid - a.pricing.totalPaid);
            } else if (params.order === 'asc') {
                enriched.reverse(); // already newest-first from the query; asc = oldest-first
            }
            enriched.sort((a, b) => (a.openSeats > 0 ? 0 : 1) - (b.openSeats > 0 ? 0 : 1)); // stable: sold-out sinks below, order otherwise preserved

            const total = enriched.length;
            const pageItems = enriched.slice(params.from, params.to + 1);

            return res.status(200).json({ listings: pageItems, total, page: params.page, pageSize: params.pageSize, categories: availableCategories, services: availableServices });
        } catch (err: any) {
            console.error('splitsubs/listings browse error:', err);
            return res.status(500).json({ error: 'Could not load listings.' });
        }
    }

    if (req.method === 'POST') {
        const host = await verifyAuth(req, res);
        if (!host) return;

        const { serviceId, shortDescription, planCost, totalSeats, proofUrl, hostFieldsData, renewalDay, subStartDate, nextRenewalDate, consentAccepted } = req.body || {};
        if (!isNonEmpty(serviceId) || !planCost || !totalSeats) {
            return res.status(400).json({ error: 'serviceId, planCost, and totalSeats are required.' });
        }
        if (consentAccepted !== true) return res.status(400).json({ error: 'Please confirm you understand the hosting terms before listing.' });
        if (shortDescription && !withinLength(shortDescription, LIMITS.description)) {
            return res.status(400).json({ error: `Short description must be ${LIMITS.description} characters or fewer.` });
        }
        if (Number(planCost) <= 0) return res.status(400).json({ error: 'planCost must be greater than zero.' });
        if (renewalDay && (Number(renewalDay) < 1 || Number(renewalDay) > 28)) {
            return res.status(400).json({ error: 'renewalDay must be between 1 and 28.' });
        }
        // Sub start/end dates (Feature Audit doc, Phase 2) — when the host's
        // actual subscription started and is next due, shown to joiners so
        // they can see how fresh a plan is. Required so every new listing
        // actually carries them (the old renewal_day-only approach left
        // next_renewal_date permanently null — nothing ever wrote it).
        if (!isNonEmpty(subStartDate) || !isNonEmpty(nextRenewalDate)) {
            return res.status(400).json({ error: 'subStartDate and nextRenewalDate are required.' });
        }
        const startDate = new Date(subStartDate);
        const renewalDate = new Date(nextRenewalDate);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(renewalDate.getTime())) {
            return res.status(400).json({ error: 'subStartDate and nextRenewalDate must be valid dates.' });
        }
        if (renewalDate <= startDate) return res.status(400).json({ error: 'nextRenewalDate must be after subStartDate.' });

        try {
            const { data: service, error: serviceError } = await supabase
                .from('ss_services')
                .select('id, name, max_seats, default_charge_rate, risk_tier, status, host_fields')
                .eq('id', serviceId)
                .maybeSingle();
            if (serviceError || !service || service.status !== 'active') {
                return res.status(400).json({ error: 'That service is not available for listing.' });
            }
            if (Number(totalSeats) < 2 || Number(totalSeats) > service.max_seats) {
                return res.status(400).json({ error: `totalSeats must be between 2 and ${service.max_seats} for this service.` });
            }
            // Catalog model (Feature Audit doc, Phase 6): proof of subscription
            // is the main thing review leans on once name/logo/seat-cap/pricing
            // are all admin-fixed catalog facts, not host-typed claims — so it's
            // required for the risk tiers where a false claim actually matters.
            if (['medium', 'high'].includes(service.risk_tier) && !isNonEmpty(proofUrl)) {
                return res.status(400).json({ error: 'Proof of subscription is required for this service.' });
            }

            const requiredKeys = (service.host_fields || []).filter((f: any) => f.required).map((f: any) => f.key);
            const missing = requiredKeys.filter((k: string) => !hostFieldsData || !isNonEmpty(String(hostFieldsData[k] ?? '')));
            if (missing.length) return res.status(400).json({ error: `Missing required host field(s): ${missing.join(', ')}` });

            const { data: listing, error } = await supabase
                .from('ss_listings')
                .insert([{
                    host_id: host.id,
                    service_id: serviceId,
                    title: service.name,
                    short_description: shortDescription ? shortDescription.trim() : null,
                    plan_cost: Number(planCost),
                    total_seats: Number(totalSeats),
                    charge_rate: service.default_charge_rate,
                    proof_url: proofUrl || null,
                    host_fields_data: hostFieldsData || {},
                    renewal_day: renewalDay ? Number(renewalDay) : null,
                    sub_start_date: subStartDate,
                    next_renewal_date: nextRenewalDate,
                    status: 'pending_review',
                }])
                .select('id, short_id')
                .single();
            if (error) throw error;

            // Merge-upsert (no ignoreDuplicates) so a profile created before this
            // column existed still gets its email backfilled on the next listing.
            await supabase.from('ss_host_profiles').upsert([{ id: host.id, email: host.email }], { onConflict: 'id' });

            await logSplitsubsActivity({
                actorType: 'host',
                actorId: host.id,
                actorLabel: `Host — ${host.email}`,
                action: `Created listing "${service.name}" (${listing.short_id}, pending review)`,
                targetType: 'listing',
                targetId: listing.id,
            });

            return res.status(200).json({ id: listing.id, shortId: listing.short_id });
        } catch (err: any) {
            console.error('splitsubs/listings create error:', err);
            return res.status(500).json({ error: err.message || 'Could not create listing.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
