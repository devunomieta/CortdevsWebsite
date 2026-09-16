import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '.../_lib/supabase.js';
import { resend, getFromAddress } from '.../_lib/resend.js';
import { logEventActivity } from '.../_lib/eventAuditLog.js';

// Daily job (PRD §04, §06, §14): for each event that ended 1–7 days ago,
// remind the admin + event owner to export; on day 7, purge attendee contact
// data automatically. Registered in vercel.json's `crons` and gated by
// CRON_SECRET so it can't be triggered by an outside request.
const RETENTION_WINDOW_DAYS = 7;

function daysSince(date: Date): number {
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

async function alreadyRemindedToday(eventId: string): Promise<boolean> {
    const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(); // 20h guard against multiple cron firings/day
    const { data } = await supabase
        .from('admin_notifications')
        .select('id')
        .eq('event_id', eventId)
        .eq('kind', 'retention')
        .gte('created_at', since)
        .limit(1);
    return !!data && data.length > 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        const { data: events, error } = await supabase
            .from('events')
            .select('id, title, slug, organizer_email, status, data_purged_at')
            .in('status', ['active', 'disabled']);
        if (error) throw error;

        let reminded = 0;
        let purged = 0;

        for (const event of events || []) {
            if (event.data_purged_at) continue;

            const { data: days } = await supabase.from('event_days').select('date, ends_at').eq('event_id', event.id).order('date', { ascending: false }).limit(1);
            const lastDay = days?.[0];
            if (!lastDay) continue;

            const endedAt = lastDay.ends_at ? new Date(lastDay.ends_at) : new Date(`${lastDay.date}T23:59:59`);
            const elapsed = daysSince(endedAt);
            if (elapsed < 1) continue; // event hasn't ended yet, or ended today

            await supabase.from('events').update({ ended_at: endedAt.toISOString() }).eq('id', event.id).is('ended_at', null);

            if (elapsed >= RETENTION_WINDOW_DAYS) {
                // Day 7+: purge attendee contact data, archive the event.
                await supabase.from('attendees').update({ full_name: null, email: null, phone: null, custom_fields: {} }).eq('event_id', event.id);
                await supabase.from('events').update({ data_purged_at: new Date().toISOString(), status: 'archived' }).eq('id', event.id);
                await logEventActivity({
                    eventId: event.id,
                    actorType: 'system',
                    actorId: null,
                    actorLabel: 'Retention policy',
                    action: 'Auto-purged attendee contact data (7-day window elapsed)',
                });
                purged += 1;
                continue;
            }

            // Days 1-7: daily reminder, once per day.
            if (await alreadyRemindedToday(event.id)) continue;

            const daysRemaining = RETENTION_WINDOW_DAYS - elapsed;
            const detail = `This event ended ${elapsed} day${elapsed === 1 ? '' : 's'} ago. Attendee contact data auto-purges in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} unless exported.`;

            await supabase.from('admin_notifications').insert([{
                event_id: event.id,
                kind: 'retention',
                title: `Retention reminder — Day ${elapsed} of ${RETENTION_WINDOW_DAYS} — ${event.title}`,
                detail,
            }]);

            if (resend && event.organizer_email) {
                await resend.emails.send({
                    from: getFromAddress('CortDevs Events'),
                    to: event.organizer_email,
                    subject: `Export reminder: ${event.title} — ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`,
                    html: `<p>${detail} Log in to your event dashboard and use "Request Export" — a Cortdevs admin will approve it and you'll get a download link.</p>`,
                });
            }

            reminded += 1;
        }

        return res.status(200).json({ success: true, reminded, purged });
    } catch (err: any) {
        console.error('cron/event-retention error:', err);
        return res.status(500).json({ error: err.message || 'Retention job failed.' });
    }
}
