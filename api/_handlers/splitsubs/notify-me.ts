import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { isValidEmail, isNonEmpty } from '../../_lib/validation.js';

// POST { email, listingId } — public, no auth required: "email me when a
// seat opens up" on a sold-out listing. Checked (and acted on) by the daily
// renewal-reminder cron — see that file for why. Silently no-ops on a
// duplicate request for the same email+listing rather than erroring, since
// from the user's side "I already asked" isn't a failure.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, listingId } = req.body || {};
    if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });
    if (!isNonEmpty(listingId)) return res.status(400).json({ error: 'listingId is required.' });

    try {
        const { data: listing } = await supabase.from('ss_listings').select('id').eq('id', listingId).maybeSingle();
        if (!listing) return res.status(404).json({ error: 'Listing not found.' });

        await supabase.from('ss_notify_requests').upsert([{ email: String(email).trim(), listing_id: listingId }], { onConflict: 'email,listing_id', ignoreDuplicates: true });
        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('splitsubs/notify-me error:', err);
        return res.status(500).json({ error: 'Could not save your request — please try again.' });
    }
}
