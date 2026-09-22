import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { sendRenewalReminder } from '../../_lib/splitsubsEmail.js';
import { getAppBaseUrl } from '../../_lib/appUrl.js';

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
        const dashboardUrl = `${getAppBaseUrl('https://splitsubs.cortdevs.com')}/dashboard`;

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

        return res.status(200).json({ success: true, listingsChecked: (listings || []).length, remindersSent: sent });
    } catch (err: any) {
        console.error('cron/splitsubs-renewal-reminders error:', err);
        return res.status(500).json({ error: err.message || 'Renewal reminder job failed.' });
    }
}
