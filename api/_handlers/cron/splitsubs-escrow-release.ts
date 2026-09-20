import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { releaseEscrowForSeat } from '../../_lib/splitsubsPayments.js';

// Runs every 15 min (see vercel.json). Auto-releases any escrow whose hold
// window has lapsed with no dispute raised — the second half of "held until
// the joiner confirms access, OR the window lapses with no dispute" (PRD
// "Escrow is the core safety mechanism"). Gated by CRON_SECRET.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { data: dueEscrow, error } = await supabase
            .from('ss_escrow')
            .select('id, seat_id')
            .eq('status', 'held')
            .lte('release_at', new Date().toISOString())
            .limit(200);
        if (error) throw error;

        let released = 0;
        for (const row of dueEscrow || []) {
            try {
                await releaseEscrowForSeat(row.seat_id, 'hold_window_elapsed');
                released += 1;
            } catch (e) {
                console.error(`escrow-release: seat ${row.seat_id} failed:`, e);
            }
        }

        return res.status(200).json({ success: true, released, checked: (dueEscrow || []).length });
    } catch (err: any) {
        console.error('cron/splitsubs-escrow-release error:', err);
        return res.status(500).json({ error: err.message || 'Escrow release job failed.' });
    }
}
