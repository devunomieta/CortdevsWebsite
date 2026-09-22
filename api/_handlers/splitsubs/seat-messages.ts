import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { isNonEmpty, withinLength, LIMITS } from '../../_lib/validation.js';
import { logSplitsubsActivity } from '../../_lib/splitsubsAuditLog.js';

// GET ?seatId=                       — a seat's chat thread (joiner or host only).
// POST { seatId, message }            — send a message; blocked once closed.
// POST { action: 'close'|'reopen', seatId } — either party can toggle the thread.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = await verifyAuth(req, res);
    if (!user) return;

    const seatId = req.method === 'GET' ? String(req.query.seatId || '') : (req.body || {}).seatId;
    if (!isNonEmpty(seatId)) return res.status(400).json({ error: 'seatId is required.' });

    const { data: seat, error: seatError } = await supabase
        .from('ss_seats')
        .select('id, joiner_id, chat_status, ss_listings(id, host_id, title)')
        .eq('id', seatId)
        .maybeSingle();
    if (seatError || !seat) return res.status(404).json({ error: 'Seat not found.' });

    const isJoiner = seat.joiner_id === user.id;
    const isHost = seat.ss_listings.host_id === user.id;
    if (!isJoiner && !isHost) return res.status(403).json({ error: 'You do not have access to this conversation.' });
    const senderType = isJoiner ? 'joiner' : 'host';

    if (req.method === 'GET') {
        try {
            const { data: messages } = await supabase.from('ss_seat_messages').select('*').eq('seat_id', seatId).order('created_at', { ascending: true });
            return res.status(200).json({ chatStatus: seat.chat_status, messages: messages || [] });
        } catch (err: any) {
            console.error('splitsubs/seat-messages get error:', err);
            return res.status(500).json({ error: 'Could not load conversation.' });
        }
    }

    if (req.method === 'POST') {
        const { action, message } = req.body || {};

        if (action === 'close' || action === 'reopen') {
            try {
                await supabase.from('ss_seats').update({ chat_status: action === 'close' ? 'closed' : 'open' }).eq('id', seatId);
                return res.status(200).json({ success: true, chatStatus: action === 'close' ? 'closed' : 'open' });
            } catch (err: any) {
                console.error('splitsubs/seat-messages toggle error:', err);
                return res.status(500).json({ error: 'Could not update conversation status.' });
            }
        }

        if (!isNonEmpty(message)) return res.status(400).json({ error: 'message is required.' });
        if (!withinLength(message, LIMITS.message)) return res.status(400).json({ error: `Message must be ${LIMITS.message} characters or fewer.` });
        if (seat.chat_status === 'closed') return res.status(400).json({ error: 'This conversation is closed — reopen it to send a message.' });

        try {
            const { data: sent, error } = await supabase
                .from('ss_seat_messages')
                .insert([{ seat_id: seatId, sender_id: user.id, sender_type: senderType, message: message.trim() }])
                .select('*')
                .single();
            if (error) throw error;

            await logSplitsubsActivity({
                actorType: senderType,
                actorId: user.id,
                actorLabel: `${senderType === 'host' ? 'Host' : 'Joiner'} — ${user.email}`,
                action: `Sent a message on "${seat.ss_listings.title}"`,
                targetType: 'seat',
                targetId: seatId,
            });

            return res.status(200).json({ message: sent });
        } catch (err: any) {
            console.error('splitsubs/seat-messages post error:', err);
            return res.status(500).json({ error: err.message || 'Could not send message.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
