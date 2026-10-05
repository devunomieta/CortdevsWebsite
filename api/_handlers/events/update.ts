import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyEventAccess } from '../../_lib/eventAuth.js';
import { logEventActivity } from '../../_lib/eventAuditLog.js';
import { broadcastEventUpdate } from '../../_lib/eventRealtime.js';
import { withinLength, isValidEmail, isValidUrl, isValidDateString, isNonEmpty, LIMITS } from '../../_lib/validation.js';

// Event Organizer update endpoint:
// Allows event organizers to edit their event's core information (title, website, description)
// and manage event dates/days schedule.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await verifyEventAccess(req, res, { requireRole: 'organizer' });
    if (!session) return;

    const { title, websiteUrl, description, days } = req.body || {};

    if (title !== undefined && (!title.trim() || !withinLength(title, LIMITS.title))) {
        return res.status(400).json({ error: `Title is required and must be ${LIMITS.title} characters or fewer.` });
    }
    if (websiteUrl && (!isValidUrl(websiteUrl) || !withinLength(websiteUrl, LIMITS.url))) {
        return res.status(400).json({ error: 'Website URL must be a valid http(s) link.' });
    }
    if (description && !withinLength(description, LIMITS.description)) {
        return res.status(400).json({ error: `Description must be ${LIMITS.description} characters or fewer.` });
    }
    if (days !== undefined) {
        if (!Array.isArray(days) || days.length === 0 || days.some((d: any) => !isValidDateString(d.date) || !isNonEmpty(d.label) || !withinLength(d.label, LIMITS.label))) {
            return res.status(400).json({ error: 'Every day needs a valid date (YYYY-MM-DD) and a label under 60 characters.' });
        }
    }

    try {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (title) patch.title = title.trim();
        if (websiteUrl !== undefined) patch.website_url = websiteUrl;
        if (description !== undefined) patch.description = description;

        if (Object.keys(patch).length > 1) {
            const { error: updateError } = await supabase
                .from('events')
                .update(patch)
                .eq('id', session.eventId);
            if (updateError) throw updateError;
        }

        // Manage event days if provided
        if (days !== undefined) {
            const { data: existingDays, error: getDaysError } = await supabase
                .from('event_days')
                .select('id, date, label')
                .eq('event_id', session.eventId);
            if (getDaysError) throw getDaysError;

            const existingMap = new Map((existingDays || []).map((d) => [d.id, d]));
            const incomingIds = new Set<string>();

            // 1. Update existing or insert new days
            for (const d of days) {
                if (d.id && existingMap.has(d.id)) {
                    incomingIds.add(d.id);
                    const current = existingMap.get(d.id)!;
                    if (current.date !== d.date || current.label !== d.label.trim()) {
                        const { error: updateDayError } = await supabase
                            .from('event_days')
                            .update({ date: d.date, label: d.label.trim() })
                            .eq('id', d.id);
                        if (updateDayError) throw updateDayError;
                    }
                } else {
                    const { data: newDay, error: insertDayError } = await supabase
                        .from('event_days')
                        .insert([{ event_id: session.eventId, date: d.date, label: d.label.trim() }])
                        .select('id')
                        .single();
                    if (insertDayError) throw insertDayError;
                    if (newDay?.id) incomingIds.add(newDay.id);
                }
            }

            // 2. Remove days that were deleted
            const toDelete = (existingDays || []).filter((d) => !incomingIds.has(d.id));
            if (toDelete.length > 0) {
                const deleteIds = toDelete.map((d) => d.id);
                const { error: deleteDaysError } = await supabase
                    .from('event_days')
                    .delete()
                    .in('id', deleteIds);
                if (deleteDaysError) throw deleteDaysError;
            }

            await logEventActivity({
                eventId: session.eventId,
                actorType: 'credential',
                actorId: session.credentialId,
                actorLabel: `${session.label} (Organizer)`,
                action: `Updated event schedule (${days.length} day${days.length === 1 ? '' : 's'})`,
            });
        }

        if (title) {
            await logEventActivity({
                eventId: session.eventId,
                actorType: 'credential',
                actorId: session.credentialId,
                actorLabel: `${session.label} (Organizer)`,
                action: `Updated event details (Title: ${title.trim()})`,
            });
        }

        // Notify active dashboards and attendees so real-time updates propagate
        await broadcastEventUpdate(session.eventId, 'event-data');

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('events/update error:', err);
        return res.status(500).json({ error: err.message || 'Could not update event.' });
    }
}
