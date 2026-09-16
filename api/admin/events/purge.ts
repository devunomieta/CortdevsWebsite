import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAdmin } from '../../_lib/auth.js';
import { logEventActivity } from '../../_lib/eventAuditLog.js';

// Manual early purge (PRD §04, §06, §12) — nulls attendee contact fields, not
// the rows, so attendance_records and historical stats survive. The same
// operation the day-7 cron (api/cron/event-retention.ts) runs automatically.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    const { eventId } = req.body || {};
    if (!eventId) return res.status(400).json({ error: 'eventId is required.' });

    try {
        const { error } = await supabase
            .from('attendees')
            .update({ full_name: null, email: null, phone: null, custom_fields: {} })
            .eq('event_id', eventId);
        if (error) throw error;

        await supabase.from('events').update({ data_purged_at: new Date().toISOString() }).eq('id', eventId);

        await logEventActivity({
            eventId,
            actorType: 'admin',
            actorId: admin.id,
            actorLabel: `Admin — ${admin.email}`,
            action: 'Purged attendee contact data (manual)',
        });

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('admin/events/purge error:', err);
        return res.status(500).json({ error: 'Could not purge attendee data.' });
    }
}
