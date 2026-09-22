import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { parseListParams, likeTerm } from '../../../_lib/splitsubsListQuery.js';

// GET ?page=&pageSize=&search=&sort=&order= — everything submitted via the
// public "request a service / country" form, for gauging real demand before
// deciding to build anything (see Feature Audit doc, Phase 1).
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const params = parseListParams(req, { allowedSorts: ['created_at'], defaultSort: 'created_at' });
        let query = supabase.from('ss_service_requests').select('*', { count: 'exact' });
        if (params.search) {
            query = query.or(`email.ilike.${likeTerm(params.search)},requested_service.ilike.${likeTerm(params.search)},requested_country.ilike.${likeTerm(params.search)}`);
        }
        const { data, error, count } = await query.order(params.sort, { ascending: params.order === 'asc' }).range(params.from, params.to);
        if (error) throw error;
        return res.status(200).json({ requests: data || [], total: count || 0, page: params.page, pageSize: params.pageSize });
    } catch (err: any) {
        console.error('admin/splitsubs/service-requests error:', err);
        return res.status(500).json({ error: 'Could not load requests.' });
    }
}
