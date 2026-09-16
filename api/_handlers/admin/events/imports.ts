import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { logEventActivity } from '../../../_lib/eventAuditLog.js';
import { broadcastEventUpdate } from '../../../_lib/eventRealtime.js';
import { attendeesFromCsv } from '../../../_lib/csv.js';

const REVIEW_URL_TTL_SECONDS = 60 * 60 * 24; // 24h to review the raw upload

async function importCsvToAttendees(eventId: string, csvContent: string) {
    const { data: event } = await supabase.from('events').select('walkin_fields').eq('id', eventId).maybeSingle();
    const result = attendeesFromCsv(csvContent, event?.walkin_fields || []);
    if (result.error) throw new Error(result.error);

    if (result.attendees.length > 0) {
        const rows = result.attendees.map((a) => ({
            event_id: eventId,
            full_name: a.fullName,
            email: a.email || null,
            phone: a.phone || null,
            source: 'imported' as const,
            custom_fields: a.customFields,
        }));
        const { error } = await supabase.from('attendees').insert(rows);
        if (error) throw error;
    }

    return { imported: result.attendees.length, skipped: result.skipped };
}

// GET ?eventId= : list import requests, each with a fresh signed URL to review the raw file.
// POST { action: 'approve' | 'deny', requestId } : decide a pending request — approving parses and imports it.
// POST { action: 'replace-and-approve', requestId, csvContent, fileName } : admin swaps in a corrected file and imports that instead.
// POST { action: 'import-now', eventId, csvContent, fileName } : admin-direct import, no approval step (still logged).
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        const eventId = String(req.query.eventId || '');
        if (!eventId) return res.status(400).json({ error: 'eventId is required.' });
        const { data, error } = await supabase
            .from('attendee_import_requests')
            .select('id, file_path, file_name, row_count, status, uploaded_at, decided_at, imported_count, skipped_count')
            .eq('event_id', eventId)
            .order('uploaded_at', { ascending: false });
        if (error) return res.status(500).json({ error: 'Could not load import requests.' });

        const requests = await Promise.all((data || []).map(async (r) => {
            const { data: signed } = await supabase.storage.from('assets').createSignedUrl(r.file_path, REVIEW_URL_TTL_SECONDS);
            return { ...r, reviewUrl: signed?.signedUrl || null };
        }));
        return res.status(200).json({ requests });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action } = req.body || {};

    try {
        if (action === 'import-now') {
            const { eventId, csvContent, fileName } = req.body;
            if (!eventId || !csvContent) return res.status(400).json({ error: 'eventId and csvContent are required.' });

            const { imported, skipped } = await importCsvToAttendees(eventId, csvContent);

            const safeName = (fileName || 'guests.csv').replace(/[^a-zA-Z0-9._-]/g, '_');
            const path = `event-imports/${eventId}/${Date.now()}-${safeName}`;
            await supabase.storage.from('assets').upload(path, csvContent, { contentType: 'text/csv', upsert: true });
            await supabase.from('attendee_import_requests').insert([{
                event_id: eventId, file_path: path, file_name: safeName, row_count: imported + skipped,
                status: 'approved', imported_count: imported, skipped_count: skipped,
                decided_by: admin.id, decided_at: new Date().toISOString(),
            }]);

            await logEventActivity({ eventId, actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`, action: `Imported ${imported} attendees directly (${skipped} skipped)` });
            await broadcastEventUpdate(eventId, 'import');

            return res.status(200).json({ success: true, imported, skipped });
        }

        const { requestId } = req.body;
        if (!requestId || !['approve', 'deny', 'replace-and-approve'].includes(action)) {
            return res.status(400).json({ error: 'requestId and a valid action are required.' });
        }

        const { data: request, error: reqError } = await supabase
            .from('attendee_import_requests')
            .select('event_id, file_path')
            .eq('id', requestId)
            .maybeSingle();
        if (reqError || !request) return res.status(404).json({ error: 'Request not found.' });

        if (action === 'deny') {
            await supabase.from('attendee_import_requests').update({ status: 'denied', decided_by: admin.id, decided_at: new Date().toISOString() }).eq('id', requestId);
            await logEventActivity({ eventId: request.event_id, actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`, action: 'Denied a guest list upload' });
            await broadcastEventUpdate(request.event_id, 'import');
            return res.status(200).json({ success: true });
        }

        let filePath = request.file_path;
        if (action === 'replace-and-approve') {
            const { csvContent, fileName } = req.body;
            if (!csvContent) return res.status(400).json({ error: 'csvContent is required to replace this file.' });
            const safeName = (fileName || 'guests.csv').replace(/[^a-zA-Z0-9._-]/g, '_');
            filePath = `event-imports/${request.event_id}/${Date.now()}-${safeName}`;
            const { error: uploadError } = await supabase.storage.from('assets').upload(filePath, csvContent, { contentType: 'text/csv', upsert: true });
            if (uploadError) throw uploadError;
        }

        const { data: fileData, error: downloadError } = await supabase.storage.from('assets').download(filePath);
        if (downloadError) throw downloadError;
        const csvContent = await fileData.text();

        const { imported, skipped } = await importCsvToAttendees(request.event_id, csvContent);

        await supabase.from('attendee_import_requests').update({
            status: 'approved',
            file_path: filePath,
            imported_count: imported,
            skipped_count: skipped,
            decided_by: admin.id,
            decided_at: new Date().toISOString(),
        }).eq('id', requestId);

        await logEventActivity({
            eventId: request.event_id, actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`,
            action: `Approved guest list upload — imported ${imported}, skipped ${skipped}`,
        });
        await broadcastEventUpdate(request.event_id, 'import');

        return res.status(200).json({ success: true, imported, skipped });
    } catch (err: any) {
        console.error('admin/events/imports error:', err);
        return res.status(500).json({ error: err.message || 'Could not process this guest list.' });
    }
}
