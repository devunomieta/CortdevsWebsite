import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';

// GET — public, aggregate-only platform stats for the homepage trust section
// (Feature Audit doc, Phase 3: "services supported / previously hosted").
// Deliberately just counts, never anything user-identifying.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const [{ count: completedSplits }, { count: activeListings }, { data: services }] = await Promise.all([
            supabase.from('ss_seats').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
            supabase.from('ss_listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
            supabase.from('ss_services').select('name, category, icon_url').eq('status', 'active').order('name'),
        ]);

        return res.status(200).json({
            completedSplits: completedSplits || 0,
            activeListings: activeListings || 0,
            services: services || [],
        });
    } catch (err: any) {
        console.error('splitsubs/stats error:', err);
        return res.status(500).json({ error: 'Could not load stats.' });
    }
}
