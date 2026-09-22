import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';

// GET: the public, active-only service catalog — powers both the "pick a
// service" step of listing creation and the browse-page filter list. Admin
// management (including inactive services) lives at admin/splitsubs/services.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { data, error } = await supabase
            .from('ss_services')
            .select('id, name, slug, category, icon_url, max_seats, default_charge_rate, risk_tier, host_fields, joiner_fields, risk_note, access_type, default_plan_cost')
            .eq('status', 'active')
            .order('name', { ascending: true });
        if (error) throw error;
        return res.status(200).json({ services: data || [] });
    } catch (err: any) {
        console.error('splitsubs/services error:', err);
        return res.status(500).json({ error: 'Could not load the service catalog.' });
    }
}
