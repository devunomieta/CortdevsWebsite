import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';

// GET ?seatId= — read-only view of a seat's joiner<->host chat thread.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    const seatId = String(req.query.seatId || '');
    if (!seatId) return res.status(400).json({ error: 'seatId is required.' });

    try {
        const { data: seat, error } = await supabase
            .from('ss_seats')
            .select('id, chat_status, ss_listings(title, host_id)')
            .eq('id', seatId)
            .maybeSingle();
        if (error || !seat) return res.status(404).json({ error: 'Seat not found.' });

        const { data: messages } = await supabase.from('ss_seat_messages').select('*').eq('seat_id', seatId).order('created_at', { ascending: true });
        return res.status(200).json({ chatStatus: seat.chat_status, listingTitle: seat.ss_listings.title, messages: messages || [] });
    } catch (err: any) {
        console.error('admin/splitsubs/seat-messages get error:', err);
        return res.status(500).json({ error: 'Could not load conversation.' });
    }
}
