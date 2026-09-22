import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { sendRenewalReminder, sendSeatAvailableAgain } from '../../_lib/splitsubsEmail.js';
import { getSplitsubsAppUrl } from '../../_lib/appUrl.js';

// Runs daily (see vercel.json). Reminds hosts and confirmed joiners at T-5
// and T-1 days before a listing's next_renewal_date (PRD "Renewal reminder
// (T-5, T-1 days)"). Gated by CRON_SECRET.
const REMINDER_OFFSETS_DAYS = [5, 1];

function isoDateNDaysFromNow(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const targetDates = REMINDER_OFFSETS_DAYS.map(isoDateNDaysFromNow);
        const { data: listings, error } = await supabase
            .from('ss_listings')
            .select('id, title, host_id, next_renewal_date, ss_services(name)')
            .eq('status', 'active')
            .in('next_renewal_date', targetDates);
        if (error) throw error;

        let sent = 0;
        const dashboardUrl = `${getSplitsubsAppUrl()}/dashboard`;

        for (const listing of listings || []) {
            const serviceName = (listing as any).ss_services?.name || listing.title;

            const { data: hostUser } = await supabase.auth.admin.getUserById(listing.host_id);
            if (hostUser?.user?.email) {
                await sendRenewalReminder(hostUser.user.email, { role: 'host', serviceName, renewalDate: listing.next_renewal_date, dashboardUrl }).catch((e) => console.error(e));
                sent += 1;
            }

            const { data: seats } = await supabase.from('ss_seats').select('joiner_id').eq('listing_id', listing.id).eq('status', 'confirmed');
            for (const seat of seats || []) {
                const { data: joinerUser } = await supabase.auth.admin.getUserById(seat.joiner_id);
                if (joinerUser?.user?.email) {
                    await sendRenewalReminder(joinerUser.user.email, { role: 'joiner', serviceName, renewalDate: listing.next_renewal_date, dashboardUrl }).catch((e) => console.error(e));
                    sent += 1;
                }
            }
        }

        // Auto-expiry (Feature Audit doc, Phase 2) — a listing whose
        // next_renewal_date has passed with no confirmation the host
        // actually renewed stops being joinable. This runs in the same
        // daily job as the reminders above on purpose: it already scans by
        // next_renewal_date every day, so there's no separate schedule to
        // keep in sync. Only 'active' listings are touched — one that's
        // already paused/suspended/expired shouldn't be relabeled by a cron
        // sweep that isn't the reason it's in that state.
        const today = new Date().toISOString().slice(0, 10);
        const { data: expired, error: expireError } = await supabase
            .from('ss_listings')
            .update({ status: 'expired' })
            .eq('status', 'active')
            .lt('next_renewal_date', today)
            .select('id');
        if (expireError) throw expireError;

        // "Notify me" (Feature Audit doc, Phase 3) — checked once a day here
        // rather than on every seat-freeing event (cancellation, refund,
        // churn, expiry) individually; those are scattered across several
        // code paths (disputes, cron expiry above, joiner cancellations),
        // and a shared daily sweep is simpler and more reliable than hooking
        // every one of them. Up to ~24h delay before someone hears a seat
        // freed up — acceptable for a first version.
        let notified = 0;
        const { data: pendingRequests } = await supabase
            .from('ss_notify_requests')
            .select('id, email, listing_id, ss_listings(status, title, ss_services(name))');
        const requestsByListing = new Map<string, typeof pendingRequests>();
        for (const r of pendingRequests || []) {
            if (!requestsByListing.has(r.listing_id)) requestsByListing.set(r.listing_id, []);
            requestsByListing.get(r.listing_id)!.push(r);
        }
        for (const [listingId, requests] of requestsByListing) {
            const first = requests![0] as any;
            if (first.ss_listings?.status !== 'active') continue;

            const { count: takenCount } = await supabase
                .from('ss_seats')
                .select('id', { count: 'exact', head: true })
                .eq('listing_id', listingId)
                .not('status', 'in', '(cancelled,refunded,churned)');
            const { data: listingSeats } = await supabase.from('ss_listings').select('total_seats').eq('id', listingId).maybeSingle();
            const openSeats = (listingSeats?.total_seats || 0) - 1 - (takenCount || 0);
            if (openSeats <= 0) continue;

            const serviceName = first.ss_listings?.ss_services?.name || first.ss_listings?.title;
            const listingUrl = `${getSplitsubsAppUrl()}/listing/${listingId}`;
            for (const r of requests || []) {
                await sendSeatAvailableAgain((r as any).email, { serviceName, listingUrl }).catch((e) => console.error(e));
                notified += 1;
            }
            await supabase.from('ss_notify_requests').delete().eq('listing_id', listingId);
        }

        return res.status(200).json({ success: true, listingsChecked: (listings || []).length, remindersSent: sent, listingsExpired: (expired || []).length, notifyRequestsSent: notified });
    } catch (err: any) {
        console.error('cron/splitsubs-renewal-reminders error:', err);
        return res.status(500).json({ error: err.message || 'Renewal reminder job failed.' });
    }
}
