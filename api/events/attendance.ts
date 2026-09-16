import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';
import { verifyEventAccess } from '../_lib/eventAuth.js';
import { logEventActivity } from '../_lib/eventAuditLog.js';
import { broadcastAttendanceUpdate } from '../_lib/eventRealtime.js';

// Confirm a check-in (PRD §08) — Full role only. Idempotent: re-confirming an
// already-checked-in guest returns the existing record instead of erroring,
// so the UI can surface "already checked in at 6:42pm" (duplicate handling).
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await verifyEventAccess(req, res, { requireRole: 'full' });
    if (!session) return;

    const { attendeeId, dayId } = req.body || {};
    if (!attendeeId || !dayId) {
        return res.status(400).json({ error: 'attendeeId and dayId are required.' });
    }

    try {
        const { data: existing } = await supabase
            .from('attendance_records')
            .select('checked_in_at')
            .eq('attendee_id', attendeeId)
            .eq('event_day_id', dayId)
            .maybeSingle();

        if (existing) {
            return res.status(200).json({ alreadyCheckedIn: true, checkedInAt: existing.checked_in_at });
        }

        const { data: attendee } = await supabase.from('attendees').select('full_name').eq('id', attendeeId).eq('event_id', session.eventId).maybeSingle();
        if (!attendee) return res.status(404).json({ error: 'Attendee not found for this event.' });

        const { data: inserted, error } = await supabase
            .from('attendance_records')
            .insert([{ attendee_id: attendeeId, event_day_id: dayId, checked_in_by_credential_id: session.credentialId, method: 'search' }])
            .select('checked_in_at')
            .single();

        if (error) throw error;

        await logEventActivity({
            eventId: session.eventId,
            actorType: 'credential',
            actorId: session.credentialId,
            actorLabel: session.label,
            action: `Checked in ${attendee.full_name || 'attendee'}`,
        });

        await broadcastAttendanceUpdate(session.eventId);

        return res.status(200).json({ alreadyCheckedIn: false, checkedInAt: inserted.checked_in_at });
    } catch (err: any) {
        console.error('events/attendance error:', err);
        return res.status(500).json({ error: 'Could not confirm check-in.' });
    }
}
