import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { logEventActivity } from '../../../_lib/eventAuditLog.js';
import { broadcastChange } from '../../../_lib/realtime.js';

// Reset event data (PRD reset flow) — deletes all attendees (cascades attendance records),
// export requests, import requests, login attempts, admin notifications, and access logins,
// while resetting data_purged_at, ended_at, and activating status back to a fresh event state.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    const { eventId } = req.body || {};
    if (!eventId) return res.status(400).json({ error: 'eventId is required.' });

    try {
        // Delete export requests for this event
        await supabase.from('export_requests').delete().eq('event_id', eventId);

        // Delete import requests for this event
        await supabase.from('attendee_import_requests').delete().eq('event_id', eventId);

        // Delete login rate-limit records for this event
        await supabase.from('login_attempts').delete().eq('event_id', eventId);

        // Delete admin notifications for this event
        await supabase.from('admin_notifications').delete().eq('event_id', eventId);

        // Delete attendees (FK cascade deletes attendance_records)
        await supabase.from('attendees').delete().eq('event_id', eventId);

        // Delete event credentials (access logins)
        await supabase.from('event_credentials').delete().eq('event_id', eventId);

        // Reset event status and retention flags
        const { error: updateErr } = await supabase
            .from('events')
            .update({
                data_purged_at: null,
                ended_at: null,
                status: 'active',
                updated_at: new Date().toISOString(),
            })
            .eq('id', eventId);

        if (updateErr) throw updateErr;

        // Log audit event
        await logEventActivity({
            eventId,
            actorType: 'admin',
            actorId: admin.id,
            actorLabel: `Admin — ${admin.email}`,
            action: 'Cleared all event data and access logins (Reset Event)',
        });

        // Broadcast realtime update to listeners
        await broadcastChange(`event-${eventId}`);
        await broadcastChange('admin-notifications');

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('admin/events/clear-data error:', err);
        return res.status(500).json({ error: 'Could not clear event data.' });
    }
}
