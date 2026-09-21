import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { withinLength, LIMITS } from '../../../_lib/validation.js';
import { logSplitsubsActivity } from '../../../_lib/splitsubsAuditLog.js';
import { sendTicketUpdate } from '../../../_lib/splitsubsEmail.js';
import { parseListParams, likeTerm } from '../../../_lib/splitsubsListQuery.js';

// GET ?id=          — one ticket's full thread (admin view).
// GET ?status=&priority=&page=&pageSize=&search=&sort=&order= — the SLA
//     queue, paginated/searchable (by subject)/sortable; sorted by priority
//     then most-recently-updated by default.
// PATCH { id, status?, reply? } — change status and/or post an admin reply.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET' && req.query.id) {
        try {
            const { data: ticket, error } = await supabase.from('ss_tickets').select('*').eq('id', String(req.query.id)).maybeSingle();
            if (error || !ticket) return res.status(404).json({ error: 'Ticket not found.' });
            const [{ data: messages }, { data: user }] = await Promise.all([
                supabase.from('ss_ticket_messages').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: true }),
                supabase.auth.admin.getUserById(ticket.user_id),
            ]);
            return res.status(200).json({ ticket: { ...ticket, userEmail: user?.user?.email }, messages: messages || [] });
        } catch (err: any) {
            console.error('admin/splitsubs/tickets get error:', err);
            return res.status(500).json({ error: 'Could not load ticket.' });
        }
    }

    if (req.method === 'GET') {
        try {
            const params = parseListParams(req, { allowedSorts: ['priority', 'status', 'updated_at', 'created_at'], defaultSort: 'priority' });
            let query = supabase.from('ss_tickets').select('*', { count: 'exact' });
            if (req.query.status) query = query.eq('status', String(req.query.status));
            if (req.query.priority) query = query.eq('priority', String(req.query.priority));
            if (params.search) query = query.ilike('subject', likeTerm(params.search));
            query = query.order(params.sort, { ascending: params.order === 'asc' });
            if (params.sort === 'priority') query = query.order('updated_at', { ascending: false }); // secondary sort, same as before
            const { data: tickets, error, count } = await query.range(params.from, params.to);
            if (error) throw error;
            return res.status(200).json({ tickets: tickets || [], total: count || 0, page: params.page, pageSize: params.pageSize });
        } catch (err: any) {
            console.error('admin/splitsubs/tickets list error:', err);
            return res.status(500).json({ error: 'Could not load tickets.' });
        }
    }

    if (req.method === 'PATCH') {
        const { id, status, reply } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id is required.' });
        if (reply && !withinLength(reply, LIMITS.message)) return res.status(400).json({ error: `Reply must be ${LIMITS.message} characters or fewer.` });
        if (status && !['open', 'pending', 'resolved', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });

        try {
            const { data: ticket } = await supabase.from('ss_tickets').select('id, user_id, subject').eq('id', id).maybeSingle();
            if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

            if (reply) await supabase.from('ss_ticket_messages').insert([{ ticket_id: id, sender_id: admin.id, sender_type: 'admin', message: reply.trim() }]);

            const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (status) patch.status = status;
            else if (reply) patch.status = 'pending'; // a reply without an explicit status means "waiting on the user now"
            await supabase.from('ss_tickets').update(patch).eq('id', id);

            if (status) {
                const { data: user } = await supabase.auth.admin.getUserById(ticket.user_id);
                if (user?.user?.email) await sendTicketUpdate(user.user.email, { subject: ticket.subject, status }).catch((e) => console.error(e));
            }

            await logSplitsubsActivity({
                actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`,
                action: `Updated ticket "${ticket.subject}"${status ? ` → ${status}` : ''}${reply ? ' (replied)' : ''}`, targetType: 'ticket', targetId: id,
            });

            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('admin/splitsubs/tickets patch error:', err);
            return res.status(500).json({ error: err.message || 'Could not update ticket.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
