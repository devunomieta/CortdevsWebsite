import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAdmin } from '../../_lib/auth.js';
import { logEventActivity } from '../../_lib/eventAuditLog.js';

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24h — the requester has a day to download once approved

function csvEscape(value: unknown): string {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

async function buildAttendeeCsv(eventId: string): Promise<string> {
    const [{ data: attendees }, { data: days }, { data: records }] = await Promise.all([
        supabase.from('attendees').select('id, full_name, email, phone, source, custom_fields').eq('event_id', eventId),
        supabase.from('event_days').select('id, label').eq('event_id', eventId).order('date', { ascending: true }),
        supabase.from('attendance_records').select('attendee_id, event_day_id, checked_in_at').in(
            'event_day_id',
            (await supabase.from('event_days').select('id').eq('event_id', eventId)).data?.map((d) => d.id) || []
        ),
    ]);

    const dayLabels = days || [];
    const recordsByAttendee = new Map<string, Map<string, string>>();
    (records || []).forEach((r) => {
        if (!recordsByAttendee.has(r.attendee_id)) recordsByAttendee.set(r.attendee_id, new Map());
        recordsByAttendee.get(r.attendee_id)!.set(r.event_day_id, r.checked_in_at);
    });

    const header = ['Full Name', 'Email', 'Phone', 'Source', ...dayLabels.map((d) => `Checked In — ${d.label}`)];
    const rows = (attendees || []).map((a) => {
        const perDay = dayLabels.map((d) => recordsByAttendee.get(a.id)?.get(d.id) || '');
        return [a.full_name, a.email, a.phone, a.source, ...perDay].map(csvEscape).join(',');
    });

    return [header.map(csvEscape).join(','), ...rows].join('\n');
}

// GET ?eventId= : list requests for an event (pending first).
// POST { action: 'approve' | 'deny', requestId } : decide one — approving
// generates the CSV and a time-boxed signed URL (PRD §04, §10, §11).
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        const eventId = String(req.query.eventId || '');
        if (!eventId) return res.status(400).json({ error: 'eventId is required.' });
        const { data, error } = await supabase
            .from('export_requests')
            .select('id, status, requested_at, decided_at, file_url')
            .eq('event_id', eventId)
            .order('requested_at', { ascending: false });
        if (error) return res.status(500).json({ error: 'Could not load export requests.' });
        return res.status(200).json({ requests: data || [] });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, requestId } = req.body || {};
    if (!requestId || (action !== 'approve' && action !== 'deny')) {
        return res.status(400).json({ error: 'requestId and a valid action are required.' });
    }

    try {
        const { data: request, error: reqError } = await supabase
            .from('export_requests')
            .select('event_id')
            .eq('id', requestId)
            .maybeSingle();
        if (reqError || !request) return res.status(404).json({ error: 'Request not found.' });

        if (action === 'deny') {
            await supabase.from('export_requests').update({ status: 'denied', decided_by: admin.id, decided_at: new Date().toISOString() }).eq('id', requestId);
            await logEventActivity({ eventId: request.event_id, actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`, action: 'Denied export request' });
            return res.status(200).json({ success: true });
        }

        // Approve: build the CSV and upload it.
        const csv = await buildAttendeeCsv(request.event_id);
        const path = `event-exports/${request.event_id}/${requestId}.csv`;
        const { error: uploadError } = await supabase.storage.from('assets').upload(path, csv, { contentType: 'text/csv', upsert: true });
        if (uploadError) throw uploadError;

        const { data: signed, error: signError } = await supabase.storage.from('assets').createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
        if (signError) throw signError;

        const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
        await supabase.from('export_requests').update({
            status: 'approved',
            decided_by: admin.id,
            decided_at: new Date().toISOString(),
            file_url: signed.signedUrl,
            expires_at: expiresAt,
        }).eq('id', requestId);

        await logEventActivity({ eventId: request.event_id, actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`, action: 'Approved export request' });

        return res.status(200).json({ success: true, fileUrl: signed.signedUrl });
    } catch (err: any) {
        console.error('admin/events/export-requests error:', err);
        return res.status(500).json({ error: err.message || 'Could not decide export request.' });
    }
}
