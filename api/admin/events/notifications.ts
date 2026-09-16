import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAdmin } from '../../_lib/auth.js';

// GET: list notifications + unread count (for the sidebar badge — PRD §04/§14).
// POST { action: 'mark-read', id } or { action: 'mark-all-read' }.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('admin_notifications')
            .select('id, event_id, kind, title, detail, read, created_at')
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) return res.status(500).json({ error: 'Could not load notifications.' });
        const unreadCount = (data || []).filter((n) => !n.read).length;
        return res.status(200).json({ notifications: data || [], unreadCount });
    }

    if (req.method === 'POST') {
        const { action, id } = req.body || {};
        if (action === 'mark-read' && id) {
            await supabase.from('admin_notifications').update({ read: true }).eq('id', id);
            return res.status(200).json({ success: true });
        }
        if (action === 'mark-all-read') {
            await supabase.from('admin_notifications').update({ read: true }).eq('read', false);
            return res.status(200).json({ success: true });
        }
        return res.status(400).json({ error: 'Unknown action.' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
