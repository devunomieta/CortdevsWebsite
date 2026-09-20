import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';

// GET — every seat the signed-in user has joined, with the listing/service
// context and, once access has been granted, the access note the host left
// (Joiner dashboard: "Secure access panel... revealed only after payment confirmed").
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const joiner = await verifyAuth(req, res);
    if (!joiner) return;

    try {
        const { data: seats, error } = await supabase
            .from('ss_seats')
            .select('*, ss_listings(id, title, renewal_day, next_renewal_date, ss_services(name, category, icon_url))')
            .eq('joiner_id', joiner.id)
            .order('created_at', { ascending: false });
        if (error) throw error;

        // access_note only makes sense once access has actually been granted —
        // strip it for any earlier status so the API never leaks it prematurely.
        const sanitized = (seats || []).map((s) => ({
            ...s,
            access_note: ['access_pending', 'confirmed'].includes(s.status) ? s.access_note : null,
        }));

        return res.status(200).json({ seats: sanitized });
    } catch (err: any) {
        console.error('splitsubs/my-seats error:', err);
        return res.status(500).json({ error: 'Could not load your subscriptions.' });
    }
}
