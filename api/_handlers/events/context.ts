import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyEventAccess } from '.../_lib/eventAuth.js';
import { getEventContext } from '.../_lib/eventContext.js';

// Re-validates the session token and returns fresh event/day data — used on
// dashboard load so a page refresh doesn't need to re-login, but still
// re-checks is_active/event status server-side every time (see
// verifyEventAccess), not just at initial login.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await verifyEventAccess(req, res);
    if (!session) return;

    const { event, days } = await getEventContext(session.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    return res.status(200).json({
        session: { label: session.label, role: session.role },
        event: { id: event.id, title: event.title, slug: event.slug, walkinFields: event.walkin_fields },
        days,
    });
}
