import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyEventAccess } from '../../_lib/eventAuth.js';
import { buildSampleCsv } from '../../_lib/csv.js';

// Returns a sample CSV matching this event's exact expected format —
// Full Name, Email, Phone, plus whatever custom walk-in fields the admin
// configured for this event. JSON body (not a raw file download) because the
// event-owner session is a bearer token, not a cookie, so a plain <a href>
// download link can't carry auth — the frontend turns this into a Blob.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await verifyEventAccess(req, res);
    if (!session) return;

    const { data: event } = await supabase.from('events').select('walkin_fields').eq('id', session.eventId).maybeSingle();
    const csv = buildSampleCsv(event?.walkin_fields || []);
    return res.status(200).json({ csv, fileName: 'guest-list-template.csv' });
}
