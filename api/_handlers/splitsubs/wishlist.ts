import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { isNonEmpty } from '../../_lib/validation.js';

// GET                  — the signed-in user's saved listings, with enough
//        service/pricing context to render as cards without a second fetch.
// POST { listingId }   — save a listing.
// DELETE { listingId } — remove a saved listing.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = await verifyAuth(req, res);
    if (!user) return;

    if (req.method === 'GET') {
        try {
            const { data } = await supabase
                .from('ss_wishlist_items')
                .select('listing_id, created_at, ss_listings(id, short_id, title, short_description, status, plan_cost, total_seats, charge_rate, ss_services(name, category, icon_url))')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            return res.status(200).json({ items: data || [] });
        } catch (err: any) {
            console.error('splitsubs/wishlist get error:', err);
            return res.status(500).json({ error: 'Could not load your wishlist.' });
        }
    }

    if (req.method === 'POST') {
        const { listingId } = req.body || {};
        if (!isNonEmpty(listingId)) return res.status(400).json({ error: 'listingId is required.' });
        try {
            await supabase.from('ss_wishlist_items').upsert([{ user_id: user.id, listing_id: listingId }], { onConflict: 'user_id,listing_id', ignoreDuplicates: true });
            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('splitsubs/wishlist post error:', err);
            return res.status(500).json({ error: 'Could not save this listing.' });
        }
    }

    if (req.method === 'DELETE') {
        const { listingId } = req.body || {};
        if (!isNonEmpty(listingId)) return res.status(400).json({ error: 'listingId is required.' });
        try {
            await supabase.from('ss_wishlist_items').delete().eq('user_id', user.id).eq('listing_id', listingId);
            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('splitsubs/wishlist delete error:', err);
            return res.status(500).json({ error: 'Could not remove this listing.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
