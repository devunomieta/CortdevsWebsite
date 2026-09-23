import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyEventAccess } from '../../_lib/eventAuth.js';
import { logEventActivity } from '../../_lib/eventAuditLog.js';
import { broadcastAttendanceUpdate } from '../../_lib/eventRealtime.js';
import { assertIsEventDay } from '../../_lib/eventContext.js';
import { isValidPhone } from '../../_lib/phone.js';
import { isValidEmail } from '../../_lib/validation.js';

// Register a walk-in (PRD §08) against the event's admin-configured
// walkin_fields, and immediately check them in for the given day. Full role only.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await verifyEventAccess(req, res, { requireRole: 'checkin_allowed' });
    if (!session) return;

    const { dayId, fullName, email, phone, customFields } = req.body || {};
    if (!dayId || !fullName || !String(fullName).trim()) {
        return res.status(400).json({ error: 'dayId and fullName are required.' });
    }
    if (String(fullName).trim().length > 200) {
        return res.status(400).json({ error: 'Full name is too long.' });
    }
    if (email && !isValidEmail(email)) {
        return res.status(400).json({ error: 'That email address doesn\'t look right.' });
    }
    if (phone && !isValidPhone(phone)) {
        return res.status(400).json({ error: 'Phone number can only contain digits, spaces, +, -, and parentheses.' });
    }

    try {
        const dayCheck = await assertIsEventDay(session.eventId, dayId);
        if (dayCheck.ok === false) return res.status(403).json({ error: dayCheck.error });

        const { data: attendee, error: attendeeError } = await supabase
            .from('attendees')
            .insert([{
                event_id: session.eventId,
                full_name: String(fullName).trim(),
                email: email ? String(email).trim() : null,
                phone: phone ? String(phone).trim() : null,
                source: 'walk-in',
                custom_fields: customFields || {},
            }])
            .select('id')
            .single();

        if (attendeeError) throw attendeeError;

        const { data: record, error: recordError } = await supabase
            .from('attendance_records')
            .insert([{ attendee_id: attendee.id, event_day_id: dayId, checked_in_by_credential_id: session.credentialId, method: 'manual' }])
            .select('checked_in_at')
            .single();

        if (recordError) throw recordError;

        await logEventActivity({
            eventId: session.eventId,
            actorType: 'credential',
            actorId: session.credentialId,
            actorLabel: session.label,
            action: `Registered walk-in ${fullName}`,
        });

        await broadcastAttendanceUpdate(session.eventId);

        return res.status(200).json({ attendeeId: attendee.id, checkedInAt: record.checked_in_at });
    } catch (err: any) {
        console.error('events/register error:', err);
        return res.status(500).json({ error: 'Could not register walk-in.' });
    }
}
