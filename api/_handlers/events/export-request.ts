import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyEventAccess } from '../../_lib/eventAuth.js';
import { logEventActivity } from '../../_lib/eventAuditLog.js';
import { broadcastAdminUpdate } from '../../_lib/eventRealtime.js';

// File or check an export request (PRD §07, §11, §12) — Full role only, both
// ways. Filing a request never returns data; only an admin approval (see
// api/admin/events/export-requests.ts) populates a downloadable file_url.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const session = await verifyEventAccess(req, res, { requireRole: 'full' });
    if (!session) return;

    if (req.method === 'GET') {
        const { data } = await supabase
            .from('export_requests')
            .select('id, status, requested_at, decided_at, file_url, expires_at')
            .eq('event_id', session.eventId)
            .order('requested_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        return res.status(200).json({ latest: data || null });
    }

    if (req.method === 'POST') {
        try {
            const { data, error } = await supabase
                .from('export_requests')
                .insert([{ event_id: session.eventId, requested_by_credential_id: session.credentialId, status: 'pending' }])
                .select('id, status, requested_at')
                .single();
            if (error) throw error;

            await logEventActivity({
                eventId: session.eventId,
                actorType: 'credential',
                actorId: session.credentialId,
                actorLabel: session.label,
                action: 'Requested attendee data export',
            });

            await supabase.from('admin_notifications').insert([{
                event_id: session.eventId,
                kind: 'export',
                title: 'Someone wants to download the guest list',
                detail: `${session.label} asked for the guest list. Approve or deny it from the event page.`,
            }]);
            await broadcastAdminUpdate('Someone wants to download the guest list');

            return res.status(200).json({ request: data });
        } catch (err: any) {
            console.error('events/export-request error:', err);
            return res.status(500).json({ error: 'Could not file export request.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
