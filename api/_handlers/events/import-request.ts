import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyEventAccess } from '../../_lib/eventAuth.js';
import { logEventActivity } from '../../_lib/eventAuditLog.js';
import { broadcastAdminUpdate } from '../../_lib/eventRealtime.js';
import { attendeesFromCsv } from '../../_lib/csv.js';

// Upload a guest-list CSV (Full access only). This never touches the
// `attendees` table directly — it queues a pending row an admin has to
// approve (which parses and imports it) or replace with a corrected file,
// mirroring the export-request approval direction (admin-gated both ways,
// not just for downloads).
//
// Format is validated here, at upload time, not deferred to admin review —
// a bad file (missing the "Full Name" column, or nothing usable in it) is
// rejected immediately with a specific reason, so the organizer gets real-time
// feedback instead of finding out only when an admin tries to approve it.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const session = await verifyEventAccess(req, res, { requireRole: 'full' });
    if (!session) return;

    if (req.method === 'GET') {
        const { data } = await supabase
            .from('attendee_import_requests')
            .select('id, file_name, row_count, status, uploaded_at, decided_at, imported_count, skipped_count')
            .eq('event_id', session.eventId)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        return res.status(200).json({ latest: data || null });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { csvContent, fileName } = req.body || {};
    if (!csvContent || typeof csvContent !== 'string') {
        return res.status(400).json({ error: 'csvContent is required.' });
    }

    try {
        const { data: event } = await supabase.from('events').select('walkin_fields').eq('id', session.eventId).maybeSingle();
        const preview = attendeesFromCsv(csvContent, event?.walkin_fields || []);

        if (preview.error) {
            return res.status(400).json({ error: preview.error });
        }
        if (preview.attendees.length === 0) {
            return res.status(400).json({
                error: preview.skipped > 0
                    ? `Every row is missing a name — ${preview.skipped} row${preview.skipped === 1 ? '' : 's'} skipped, 0 usable.`
                    : 'That file has no attendee rows in it.',
            });
        }

        const safeName = (fileName || 'guests.csv').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `event-imports/${session.eventId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('assets').upload(path, csvContent, { contentType: 'text/csv', upsert: true });
        if (uploadError) throw uploadError;

        const { data: request, error } = await supabase
            .from('attendee_import_requests')
            .insert([{
                event_id: session.eventId,
                uploaded_by_credential_id: session.credentialId,
                file_path: path,
                file_name: safeName,
                row_count: preview.total,
                status: 'pending',
            }])
            .select('id, status, uploaded_at, row_count')
            .single();
        if (error) throw error;

        await logEventActivity({
            eventId: session.eventId,
            actorType: 'credential',
            actorId: session.credentialId,
            actorLabel: session.label,
            action: `Uploaded a guest list (${preview.attendees.length} usable rows${preview.skipped ? `, ${preview.skipped} skipped` : ''}) for review`,
        });

        await supabase.from('admin_notifications').insert([{
            event_id: session.eventId,
            kind: 'import',
            title: 'A guest list is waiting for review',
            detail: `${session.label} uploaded "${safeName}" (${preview.attendees.length} usable rows). Review and approve it from the event page.`,
        }]);
        await broadcastAdminUpdate('A guest list is waiting for review');

        return res.status(200).json({
            request,
            preview: {
                usable: preview.attendees.length,
                skipped: preview.skipped,
                invalidPhones: preview.invalidPhones,
                invalidEmails: preview.invalidEmails,
            },
        });
    } catch (err: any) {
        console.error('events/import-request error:', err);
        return res.status(500).json({ error: err.message || 'Could not upload the guest list.' });
    }
}
