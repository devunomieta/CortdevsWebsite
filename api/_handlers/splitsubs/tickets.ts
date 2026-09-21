import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { isNonEmpty, withinLength, LIMITS } from '../../_lib/validation.js';
import { logSplitsubsActivity } from '../../_lib/splitsubsAuditLog.js';
import { parseListParams, likeTerm } from '../../_lib/splitsubsListQuery.js';

const CATEGORY_PRIORITY: Record<string, 'P1' | 'P2' | 'P3'> = {
    payment: 'P1',
    account_security: 'P1',
    access: 'P2',
    refund: 'P2',
    host_unresponsive: 'P2',
    other: 'P3',
};

// GET ?id=       — one ticket with its message thread (must be the owner).
// GET (default)   — the signed-in user's tickets.
// POST             — open a new ticket; priority is derived from category
// (PRD "Support System" SLA table), never client-supplied.
// POST { action: 'reply', ticketId, message } — add a message to your own ticket.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = await verifyAuth(req, res);
    if (!user) return;

    if (req.method === 'GET' && req.query.id) {
        try {
            const { data: ticket, error } = await supabase.from('ss_tickets').select('*').eq('id', String(req.query.id)).eq('user_id', user.id).maybeSingle();
            if (error || !ticket) return res.status(404).json({ error: 'Ticket not found.' });
            const { data: messages } = await supabase.from('ss_ticket_messages').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: true });
            return res.status(200).json({ ticket, messages: messages || [] });
        } catch (err: any) {
            console.error('splitsubs/tickets get error:', err);
            return res.status(500).json({ error: 'Could not load ticket.' });
        }
    }

    if (req.method === 'GET') {
        try {
            const params = parseListParams(req, { allowedSorts: ['updated_at', 'created_at', 'priority', 'status'], defaultSort: 'updated_at' });
            let query = supabase.from('ss_tickets').select('*', { count: 'exact' }).eq('user_id', user.id);
            if (req.query.status) query = query.eq('status', String(req.query.status));
            if (params.search) query = query.ilike('subject', likeTerm(params.search));
            const { data: tickets, error, count } = await query.order(params.sort, { ascending: params.order === 'asc' }).range(params.from, params.to);
            if (error) throw error;
            return res.status(200).json({ tickets: tickets || [], total: count || 0, page: params.page, pageSize: params.pageSize });
        } catch (err: any) {
            console.error('splitsubs/tickets list error:', err);
            return res.status(500).json({ error: 'Could not load your tickets.' });
        }
    }

    if (req.method === 'POST') {
        const { action } = req.body || {};

        if (action === 'reply') {
            const { ticketId, message } = req.body || {};
            if (!isNonEmpty(ticketId) || !isNonEmpty(message)) return res.status(400).json({ error: 'ticketId and message are required.' });
            if (!withinLength(message, LIMITS.message)) return res.status(400).json({ error: `Message must be ${LIMITS.message} characters or fewer.` });

            try {
                const { data: ticket } = await supabase.from('ss_tickets').select('id, user_id, status').eq('id', ticketId).maybeSingle();
                if (!ticket || ticket.user_id !== user.id) return res.status(404).json({ error: 'Ticket not found.' });

                await supabase.from('ss_ticket_messages').insert([{ ticket_id: ticketId, sender_id: user.id, sender_type: 'user', message: message.trim() }]);
                await supabase.from('ss_tickets').update({ status: ticket.status === 'resolved' ? 'open' : ticket.status, updated_at: new Date().toISOString() }).eq('id', ticketId);

                return res.status(200).json({ success: true });
            } catch (err: any) {
                console.error('splitsubs/tickets reply error:', err);
                return res.status(500).json({ error: 'Could not send message.' });
            }
        }

        const { category, subject, message, listingId, seatId } = req.body || {};
        if (!isNonEmpty(category) || !isNonEmpty(subject) || !isNonEmpty(message)) {
            return res.status(400).json({ error: 'category, subject, and message are required.' });
        }
        if (!withinLength(subject, LIMITS.title)) return res.status(400).json({ error: `Subject must be ${LIMITS.title} characters or fewer.` });
        if (!withinLength(message, LIMITS.message)) return res.status(400).json({ error: `Message must be ${LIMITS.message} characters or fewer.` });
        const priority = CATEGORY_PRIORITY[category];
        if (!priority) return res.status(400).json({ error: 'Unknown ticket category.' });

        try {
            const { data: ticket, error } = await supabase
                .from('ss_tickets')
                .insert([{
                    user_id: user.id, category, priority, subject: subject.trim(),
                    listing_id: listingId || null, seat_id: seatId || null,
                }])
                .select('id')
                .single();
            if (error) throw error;

            await supabase.from('ss_ticket_messages').insert([{ ticket_id: ticket.id, sender_id: user.id, sender_type: 'user', message: message.trim() }]);

            await logSplitsubsActivity({
                actorType: 'joiner', actorId: user.id, actorLabel: `User — ${user.email}`,
                action: `Opened ${priority} ticket: ${subject}`, targetType: 'ticket', targetId: ticket.id,
            });

            return res.status(200).json({ id: ticket.id, priority });
        } catch (err: any) {
            console.error('splitsubs/tickets create error:', err);
            return res.status(500).json({ error: err.message || 'Could not open ticket.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
