import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';

// GET ?limit= — the most recent audit-log entries (default 100, max 500).
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const limit = Math.min(Number(req.query.limit) || 100, 500);
        const { data, error } = await supabase.from('ss_audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return res.status(200).json({ entries: data || [] });
    } catch (err: any) {
        console.error('admin/splitsubs/audit-log error:', err);
        return res.status(500).json({ error: 'Could not load audit log.' });
    }
}
