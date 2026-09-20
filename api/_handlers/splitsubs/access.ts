import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { releaseEscrowForSeat } from '../../_lib/splitsubsPayments.js';
import { logSplitsubsActivity } from '../../_lib/splitsubsAuditLog.js';
import { sendAccessGrantedToJoiner } from '../../_lib/splitsubsEmail.js';
import { isNonEmpty, withinLength, LIMITS } from '../../_lib/validation.js';

// POST { action: 'grant', seatId, accessNote } — host delivers access.
// POST { action: 'confirm', seatId } — joiner confirms it works; releases escrow.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = await verifyAuth(req, res);
    if (!user) return;

    const { action, seatId, accessNote } = req.body || {};
    if (!isNonEmpty(seatId)) return res.status(400).json({ error: 'seatId is required.' });

    try {
        const { data: seat, error } = await supabase
            .from('ss_seats')
            .select('*, ss_listings(id, host_id, title)')
            .eq('id', seatId)
            .maybeSingle();
        if (error || !seat) return res.status(404).json({ error: 'Seat not found.' });

        if (action === 'grant') {
            if (seat.ss_listings.host_id !== user.id) return res.status(403).json({ error: 'Only the host can grant access.' });
            if (seat.status !== 'escrow_held') return res.status(400).json({ error: 'This seat is not awaiting access delivery.' });
            if (accessNote && !withinLength(accessNote, LIMITS.message)) return res.status(400).json({ error: `Access note must be ${LIMITS.message} characters or fewer.` });

            const { data: escrow } = await supabase.from('ss_escrow').select('release_at').eq('seat_id', seatId).eq('status', 'held').maybeSingle();

            await supabase.from('ss_seats').update({
                status: 'access_pending',
                access_granted_at: new Date().toISOString(),
                access_note: accessNote || null,
                confirm_deadline: escrow?.release_at || null,
            }).eq('id', seatId);

            const { data: joinerUser } = await supabase.auth.admin.getUserById(seat.joiner_id);
            if (joinerUser?.user?.email) {
                await sendAccessGrantedToJoiner(joinerUser.user.email, {
                    serviceName: seat.ss_listings.title,
                    accessInfoHtml: accessNote ? accessNote.replace(/\n/g, '<br/>') : 'Check your SplitSubs dashboard for details.',
                    confirmUrl: `${process.env.VITE_APP_URL || 'https://splitsubs.cortdevs.com'}/dashboard`,
                }).catch((e) => console.error('sendAccessGrantedToJoiner failed:', e));
            }

            await logSplitsubsActivity({
                actorType: 'host', actorId: user.id, actorLabel: `Host — ${user.email}`,
                action: `Granted access for seat on "${seat.ss_listings.title}"`, targetType: 'seat', targetId: seatId,
            });

            return res.status(200).json({ success: true });
        }

        if (action === 'confirm') {
            if (seat.joiner_id !== user.id) return res.status(403).json({ error: 'Only the joiner can confirm their own access.' });
            if (!['access_pending', 'escrow_held'].includes(seat.status)) return res.status(400).json({ error: 'This seat has nothing to confirm.' });

            await releaseEscrowForSeat(seatId, 'joiner_confirmed');

            await logSplitsubsActivity({
                actorType: 'joiner', actorId: user.id, actorLabel: `Joiner — ${user.email}`,
                action: `Confirmed access for seat on "${seat.ss_listings.title}"`, targetType: 'seat', targetId: seatId,
            });

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Unknown action.' });
    } catch (err: any) {
        console.error('splitsubs/access error:', err);
        return res.status(500).json({ error: err.message || 'Could not update access.' });
    }
}
