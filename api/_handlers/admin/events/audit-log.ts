import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    const eventId = String(req.query.eventId || '');
    if (!eventId) return res.status(400).json({ error: 'eventId is required.' });

    const { data, error } = await supabase
        .from('event_audit_log')
        .select('id, actor_label, action, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(200);

    if (error) return res.status(500).json({ error: 'Could not load activity log.' });
    return res.status(200).json({ entries: data || [] });
}
