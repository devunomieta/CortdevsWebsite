import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAdmin } from '../../_lib/auth.js';
import { logEventActivity } from '../../_lib/eventAuditLog.js';

// Update event fields, or flip status (active <-> disabled, or -> archived) —
// the dashboard kill switch from PRD §07 is just a status write here.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    const { id, status, title, organizerName, organizerEmail, websiteUrl, description, walkinFields } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required.' });

    try {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (status) patch.status = status;
        if (title) patch.title = title;
        if (organizerName) patch.organizer_name = organizerName;
        if (organizerEmail) patch.organizer_email = organizerEmail;
        if (websiteUrl !== undefined) patch.website_url = websiteUrl;
        if (description !== undefined) patch.description = description;
        if (walkinFields) patch.walkin_fields = walkinFields;

        const { error } = await supabase.from('events').update(patch).eq('id', id);
        if (error) throw error;

        if (status) {
            await logEventActivity({
                eventId: id,
                actorType: 'admin',
                actorId: admin.id,
                actorLabel: `Admin — ${admin.email}`,
                action: status === 'disabled' ? 'Disabled dashboard' : status === 'active' ? 'Re-enabled dashboard' : `Set status to ${status}`,
            });
        }

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('admin/events/update error:', err);
        return res.status(500).json({ error: 'Could not update event.' });
    }
}
