import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { isNonEmpty, withinLength, LIMITS } from '../../_lib/validation.js';
import { logSplitsubsActivity } from '../../_lib/splitsubsAuditLog.js';

// GET  — disputes the signed-in user raised or is otherwise party to.
// POST — raise a dispute on a seat (PRD "Dispute triggers"). This freezes
// that seat's escrow (releaseEscrowForSeat checks for an open dispute before
// releasing) until an admin resolves it — see admin/splitsubs/disputes.ts.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = await verifyAuth(req, res);
    if (!user) return;

    if (req.method === 'GET') {
        try {
            const { data: disputes, error } = await supabase
                .from('ss_disputes')
                .select('*, ss_seats(id, joiner_id, ss_listings(host_id, title))')
                .order('created_at', { ascending: false });
            if (error) throw error;
            const mine = (disputes || []).filter((d) => d.raised_by === user.id || d.ss_seats?.joiner_id === user.id || d.ss_seats?.ss_listings?.host_id === user.id);
            return res.status(200).json({ disputes: mine });
        } catch (err: any) {
            console.error('splitsubs/disputes get error:', err);
            return res.status(500).json({ error: 'Could not load disputes.' });
        }
    }

    if (req.method === 'POST') {
        const { seatId, reason, details } = req.body || {};
        if (!isNonEmpty(seatId) || !isNonEmpty(reason)) return res.status(400).json({ error: 'seatId and reason are required.' });
        if (details && !withinLength(details, LIMITS.message)) return res.status(400).json({ error: `Details must be ${LIMITS.message} characters or fewer.` });

        try {
            const { data: seat } = await supabase.from('ss_seats').select('id, joiner_id, status, ss_listings(host_id, title)').eq('id', seatId).maybeSingle();
            if (!seat) return res.status(404).json({ error: 'Seat not found.' });
            if (seat.joiner_id !== user.id && seat.ss_listings.host_id !== user.id) return res.status(403).json({ error: "You weren't part of this split." });
            if (!['escrow_held', 'access_pending', 'confirmed'].includes(seat.status)) {
                return res.status(400).json({ error: 'This seat has no payment in flight to dispute.' });
            }

            const { data: existing } = await supabase.from('ss_disputes').select('id').eq('seat_id', seatId).in('status', ['open', 'investigating']).maybeSingle();
            if (existing) return res.status(409).json({ error: 'There is already an open dispute on this seat.' });

            const { data: dispute, error } = await supabase
                .from('ss_disputes')
                .insert([{ seat_id: seatId, raised_by: user.id, reason: reason.trim(), details: details || null }])
                .select('id')
                .single();
            if (error) throw error;

            await supabase.from('ss_seats').update({ status: 'disputed' }).eq('id', seatId);

            await logSplitsubsActivity({
                actorType: user.id === seat.ss_listings.host_id ? 'host' : 'joiner', actorId: user.id, actorLabel: `${user.email}`,
                action: `Raised a dispute on "${seat.ss_listings.title}": ${reason}`, targetType: 'seat', targetId: seatId,
            });

            return res.status(200).json({ id: dispute.id });
        } catch (err: any) {
            console.error('splitsubs/disputes create error:', err);
            return res.status(500).json({ error: err.message || 'Could not open dispute.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
