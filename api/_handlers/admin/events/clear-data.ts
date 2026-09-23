import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { logEventActivity } from '../../../_lib/eventAuditLog.js';

// Reset event data — deletes all attendees (cascades attendance records),
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
        // 1. Delete export requests for this event
        const { error: expErr } = await supabase.from('export_requests').delete().eq('event_id', eventId);
        if (expErr) console.warn('export_requests delete warning:', expErr.message);

        // 2. Delete import requests for this event
        const { error: impErr } = await supabase.from('attendee_import_requests').delete().eq('event_id', eventId);
        if (impErr) console.warn('attendee_import_requests delete warning:', impErr.message);

        // 3. Delete login rate-limit records for this event
        const { error: logErr } = await supabase.from('login_attempts').delete().eq('event_id', eventId);
        if (logErr) console.warn('login_attempts delete warning:', logErr.message);

        // 4. Delete admin notifications for this event
        const { error: notifErr } = await supabase.from('admin_notifications').delete().eq('event_id', eventId);
        if (notifErr) console.warn('admin_notifications delete warning:', notifErr.message);

        // 5. Delete attendees (FK cascade deletes attendance_records)
        const { error: attErr } = await supabase.from('attendees').delete().eq('event_id', eventId);
        if (attErr) throw attErr;

        // 6. Delete event credentials (access logins)
        const { error: credErr } = await supabase.from('event_credentials').delete().eq('event_id', eventId);
        if (credErr) throw credErr;

        // 7. Reset event status and retention flags
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

        // 8. Log audit event
        await logEventActivity({
            eventId,
            actorType: 'admin',
            actorId: admin.id,
            actorLabel: `Admin — ${admin.email}`,
            action: 'Cleared all event data and access logins (Reset Event)',
        });

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('admin/events/clear-data error:', err);
        return res.status(500).json({ error: err.message || 'Could not clear event data.' });
    }
}
