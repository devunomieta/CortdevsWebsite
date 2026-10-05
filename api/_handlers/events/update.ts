import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyEventAccess } from '../../_lib/eventAuth.js';
import { logEventActivity } from '../../_lib/eventAuditLog.js';
import { broadcastEventUpdate } from '../../_lib/eventRealtime.js';
import { uniqueEventSlug } from '../../_lib/slug.js';
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

    const { title, websiteUrl, bannerUrl, flierUrl, description, startDate, endDate, days } = req.body || {};

    if (title !== undefined && (!title.trim() || !withinLength(title, LIMITS.title))) {
        return res.status(400).json({ error: `Title is required and must be ${LIMITS.title} characters or fewer.` });
    }
    if (websiteUrl && (!isValidUrl(websiteUrl) || !withinLength(websiteUrl, LIMITS.url))) {
        return res.status(400).json({ error: 'Website URL must be a valid http(s) link.' });
    }
    if (bannerUrl && (!isValidUrl(bannerUrl) || !withinLength(bannerUrl, LIMITS.url))) {
        return res.status(400).json({ error: 'Banner URL must be a valid http(s) link.' });
    }
    if (flierUrl && (!isValidUrl(flierUrl) || !withinLength(flierUrl, LIMITS.url))) {
        return res.status(400).json({ error: 'Flier URL must be a valid http(s) link.' });
    }
    if (description && !withinLength(description, LIMITS.description)) {
        return res.status(400).json({ error: `Description must be ${LIMITS.description} characters or fewer.` });
    }
    if (startDate !== undefined && startDate !== null && startDate !== '' && !isValidDateString(startDate)) {
        return res.status(400).json({ error: 'Start date must be a valid date (YYYY-MM-DD).' });
    }
    if (endDate !== undefined && endDate !== null && endDate !== '' && !isValidDateString(endDate)) {
        return res.status(400).json({ error: 'End date must be a valid date (YYYY-MM-DD).' });
    }

    try {
        // Fetch current event to know existing title, slug, and dates
        const { data: currentEvent, error: currentEventError } = await supabase
            .from('events')
            .select('title, slug, start_date, end_date')
            .eq('id', session.eventId)
            .maybeSingle();
        if (currentEventError || !currentEvent) return res.status(404).json({ error: 'Event not found.' });

        const effectiveStartDate = startDate !== undefined ? (startDate || null) : currentEvent.start_date;
        const effectiveEndDate = endDate !== undefined ? (endDate || null) : currentEvent.end_date;

        if (effectiveStartDate && effectiveEndDate && effectiveStartDate > effectiveEndDate) {
            return res.status(400).json({ error: 'Event start date cannot be after end date.' });
        }

        if (days !== undefined) {
            if (!Array.isArray(days) || days.length === 0 || days.some((d: any) => !isValidDateString(d.date) || !isNonEmpty(d.label) || !withinLength(d.label, LIMITS.label))) {
                return res.status(400).json({ error: 'Every day needs a valid date (YYYY-MM-DD) and a label under 60 characters.' });
            }
            if (effectiveStartDate && days.some((d: any) => d.date < effectiveStartDate)) {
                return res.status(400).json({ error: `Schedule date cannot be earlier than event start date (${effectiveStartDate}).` });
            }
            if (effectiveEndDate && days.some((d: any) => d.date > effectiveEndDate)) {
                return res.status(400).json({ error: `Schedule date cannot be later than event end date (${effectiveEndDate}).` });
            }
        } else if (startDate !== undefined || endDate !== undefined) {
            // If days were not provided in this call, verify that existing days satisfy the new boundary
            const { data: existingDays } = await supabase.from('event_days').select('date, label').eq('event_id', session.eventId);
            if (existingDays && existingDays.length > 0) {
                if (effectiveStartDate && existingDays.some((d) => d.date < effectiveStartDate)) {
                    return res.status(400).json({ error: `Existing day schedule falls before new start date (${effectiveStartDate}). Please adjust schedule days first.` });
                }
                if (effectiveEndDate && existingDays.some((d) => d.date > effectiveEndDate)) {
                    return res.status(400).json({ error: `Existing day schedule falls after new end date (${effectiveEndDate}). Please adjust schedule days first.` });
                }
            }
        }

        let newSlug: string | null = null;
        const trimmedTitle = title ? title.trim() : undefined;
        if (trimmedTitle && trimmedTitle !== currentEvent.title) {
            newSlug = await uniqueEventSlug(trimmedTitle);
        }

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (trimmedTitle) patch.title = trimmedTitle;
        if (newSlug) patch.slug = newSlug;
        if (websiteUrl !== undefined) patch.website_url = websiteUrl || null;
        if (bannerUrl !== undefined) patch.banner_url = bannerUrl || null;
        if (flierUrl !== undefined) patch.flier_url = flierUrl || null;
        if (description !== undefined) patch.description = description || null;
        if (startDate !== undefined) patch.start_date = startDate || null;
        if (endDate !== undefined) patch.end_date = endDate || null;

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

            const existingMap = new Map<string, { id: string; date: string; label: string }>(
                (existingDays || []).map((d: any) => [d.id, d])
            );
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

        if (trimmedTitle) {
            await logEventActivity({
                eventId: session.eventId,
                actorType: 'credential',
                actorId: session.credentialId,
                actorLabel: `${session.label} (Organizer)`,
                action: newSlug
                    ? `Updated event title to "${trimmedTitle}" (New link: ${newSlug})`
                    : `Updated event title to "${trimmedTitle}"`,
            });
        }

        // If the slug changed, notify active dashboards to force a re-login at the new URL
        if (newSlug) {
            await broadcastEventUpdate(session.eventId, 'slug-changed', {
                oldSlug: currentEvent.slug,
                newSlug,
                newTitle: trimmedTitle,
                reason: 'The event title and link were updated by an organizer.',
            });
        } else {
            // Otherwise broadcast standard data update
            await broadcastEventUpdate(session.eventId, 'event-data');
        }

        return res.status(200).json({ success: true, newSlug: newSlug || currentEvent.slug });
    } catch (err: any) {
        console.error('events/update error:', err);
        return res.status(500).json({ error: err.message || 'Could not update event.' });
    }
}
