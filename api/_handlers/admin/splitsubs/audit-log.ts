import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { parseListParams, likeTerm } from '../../../_lib/splitsubsListQuery.js';

// GET ?actorType=&page=&pageSize=&search=&sort=&order= — the audit log,
// paginated/searchable (by action text)/sortable, optionally filtered to one
// actor type (admin/host/joiner/system).
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const params = parseListParams(req, { allowedSorts: ['created_at', 'actor_type'], defaultSort: 'created_at' });
        let query = supabase.from('ss_audit_log').select('*', { count: 'exact' });
        if (req.query.actorType) query = query.eq('actor_type', String(req.query.actorType));
        if (params.search) query = query.or(`action.ilike.${likeTerm(params.search)},actor_label.ilike.${likeTerm(params.search)}`);
        const { data, error, count } = await query.order(params.sort, { ascending: params.order === 'asc' }).range(params.from, params.to);
        if (error) throw error;
        return res.status(200).json({ entries: data || [], total: count || 0, page: params.page, pageSize: params.pageSize });
    } catch (err: any) {
        console.error('admin/splitsubs/audit-log error:', err);
        return res.status(500).json({ error: 'Could not load audit log.' });
    }
}
