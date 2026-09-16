import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { logEventActivity } from '../../../_lib/eventAuditLog.js';
import { withinLength, isValidEmail, isValidUrl, isValidFieldName, LIMITS } from '../../../_lib/validation.js';

// Update event fields, or flip status (active <-> disabled, or -> archived) —
// the dashboard kill switch from PRD §07 is just a status write here.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    const { id, status, title, organizerName, organizerEmail, websiteUrl, flierUrl, description, walkinFields } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required.' });

    if (status && !['active', 'disabled', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
    }
    if (title !== undefined && (!title.trim() || !withinLength(title, LIMITS.title))) {
        return res.status(400).json({ error: `Title is required and must be ${LIMITS.title} characters or fewer.` });
    }
    if (organizerName !== undefined && (!organizerName.trim() || !withinLength(organizerName, LIMITS.name))) {
        return res.status(400).json({ error: `Organizer name is required and must be ${LIMITS.name} characters or fewer.` });
    }
    if (organizerEmail !== undefined && !isValidEmail(organizerEmail)) {
        return res.status(400).json({ error: 'Organizer email doesn\'t look valid.' });
    }
    if (websiteUrl && (!isValidUrl(websiteUrl) || !withinLength(websiteUrl, LIMITS.url))) {
        return res.status(400).json({ error: 'Website URL must be a valid http(s) link.' });
    }
    if (description && !withinLength(description, LIMITS.description)) {
        return res.status(400).json({ error: `Description must be ${LIMITS.description} characters or fewer.` });
    }
    if (walkinFields && (!Array.isArray(walkinFields) || walkinFields.some((f: any) => !isValidFieldName(f)))) {
        return res.status(400).json({ error: 'Custom field names can only use letters, numbers, spaces, and basic punctuation, up to 40 characters.' });
    }

    try {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (status) patch.status = status;
        if (title) patch.title = title.trim();
        if (organizerName) patch.organizer_name = organizerName.trim();
        if (organizerEmail) patch.organizer_email = organizerEmail.trim().toLowerCase();
        if (websiteUrl !== undefined) patch.website_url = websiteUrl;
        if (flierUrl !== undefined) patch.flier_url = flierUrl;
        if (description !== undefined) patch.description = description;
        if (walkinFields) patch.walkin_fields = walkinFields.map((f: string) => f.trim());

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
