import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { withinLength, LIMITS } from '../../_lib/validation.js';

// POST — rate the other party on a completed seat (PRD "Reputation &
// enforcement — two-way ratings after each completed cycle"). Only the
// joiner or the listing's host on that seat may rate, only once each, and
// only after the seat reached 'confirmed'.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = await verifyAuth(req, res);
    if (!user) return;

    const { seatId, rating, comment } = req.body || {};
    if (!seatId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'seatId and a rating between 1 and 5 are required.' });
    }
    if (comment && !withinLength(comment, LIMITS.message)) return res.status(400).json({ error: `Comment must be ${LIMITS.message} characters or fewer.` });

    try {
        const { data: seat, error } = await supabase.from('ss_seats').select('id, joiner_id, status, ss_listings(host_id)').eq('id', seatId).maybeSingle();
        if (error || !seat) return res.status(404).json({ error: 'Seat not found.' });
        if (seat.status !== 'confirmed') return res.status(400).json({ error: 'Ratings open once the split is confirmed.' });

        const hostId = seat.ss_listings.host_id;
        let rateeId: string;
        if (user.id === seat.joiner_id) rateeId = hostId;
        else if (user.id === hostId) rateeId = seat.joiner_id;
        else return res.status(403).json({ error: "You weren't part of this split." });

        const { error: insertError } = await supabase.from('ss_ratings').insert([{ seat_id: seatId, rater_id: user.id, ratee_id: rateeId, rating, comment: comment || null }]);
        if (insertError) {
            if (insertError.code === '23505') return res.status(409).json({ error: "You've already rated this split." });
            throw insertError;
        }

        const { data: profile } = await supabase.from('ss_host_profiles').select('rating_sum, rating_count, email').eq('id', rateeId).maybeSingle();
        const rateeEmail = profile?.email || (await supabase.auth.admin.getUserById(rateeId)).data?.user?.email || null;
        await supabase.from('ss_host_profiles').upsert([{
            id: rateeId,
            email: rateeEmail,
            rating_sum: (profile?.rating_sum || 0) + rating,
            rating_count: (profile?.rating_count || 0) + 1,
        }], { onConflict: 'id' });

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('splitsubs/ratings error:', err);
        return res.status(500).json({ error: err.message || 'Could not save rating.' });
    }
}
