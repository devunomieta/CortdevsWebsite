import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { logEventActivity } from '../../../_lib/eventAuditLog.js';
import { broadcastEventUpdate } from '../../../_lib/eventRealtime.js';
import { withinLength, isValidEmail, isValidUrl, isValidFieldName, isValidDateString, isNonEmpty, LIMITS } from '../../../_lib/validation.js';

// Update event fields, days/dates, or flip status (active <-> disabled, or -> archived) —
// the dashboard kill switch from PRD §07 is just a status write here.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    const { id, status, title, organizerName, organizerEmail, websiteUrl, flierUrl, description, timezone, walkinFields, startDate, endDate, days } = req.body || {};
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
    if (startDate !== undefined && startDate !== null && startDate !== '' && !isValidDateString(startDate)) {
        return res.status(400).json({ error: 'Start date must be a valid date (YYYY-MM-DD).' });
    }
    if (endDate !== undefined && endDate !== null && endDate !== '' && !isValidDateString(endDate)) {
        return res.status(400).json({ error: 'End date must be a valid date (YYYY-MM-DD).' });
    }

    try {
        // Fetch current event to know existing start/end date if only one is updated, or to validate days
        const { data: currentEvent, error: currentEventError } = await supabase
            .from('events')
            .select('start_date, end_date')
            .eq('id', id)
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
            const { data: existingDays } = await supabase.from('event_days').select('date, label').eq('event_id', id);
            if (existingDays && existingDays.length > 0) {
                if (effectiveStartDate && existingDays.some((d) => d.date < effectiveStartDate)) {
                    return res.status(400).json({ error: `Existing day schedule falls before new start date (${effectiveStartDate}). Please adjust schedule days first.` });
                }
                if (effectiveEndDate && existingDays.some((d) => d.date > effectiveEndDate)) {
                    return res.status(400).json({ error: `Existing day schedule falls after new end date (${effectiveEndDate}). Please adjust schedule days first.` });
                }
            }
        }

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (status) patch.status = status;
        if (title) patch.title = title.trim();
        if (organizerName) patch.organizer_name = organizerName.trim();
        if (organizerEmail) patch.organizer_email = organizerEmail.trim().toLowerCase();
        if (websiteUrl !== undefined) patch.website_url = websiteUrl;
        if (flierUrl !== undefined) patch.flier_url = flierUrl;
        if (description !== undefined) patch.description = description;
        if (timezone !== undefined) patch.timezone = timezone;
        if (walkinFields) patch.walkin_fields = walkinFields.map((f: string) => f.trim());
        if (startDate !== undefined) patch.start_date = startDate || null;
        if (endDate !== undefined) patch.end_date = endDate || null;

        if (Object.keys(patch).length > 1) {
            const { error } = await supabase.from('events').update(patch).eq('id', id);
            if (error) throw error;
        }

        // Manage event days if provided
        if (days !== undefined) {
            const { data: existingDays, error: getDaysError } = await supabase
                .from('event_days')
                .select('id, date, label')
                .eq('event_id', id);
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
                        .insert([{ event_id: id, date: d.date, label: d.label.trim() }])
                        .select('id')
                        .single();
                    if (insertDayError) throw insertDayError;
                    if (newDay?.id) incomingIds.add(newDay.id);
                }
            }

            // 2. Remove days that were deleted by admin
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
                eventId: id,
                actorType: 'admin',
                actorId: admin.id,
                actorLabel: `Admin — ${admin.email}`,
                action: `Updated event schedule (${days.length} day${days.length === 1 ? '' : 's'})`,
            });
        }

        if (status) {
            await logEventActivity({
                eventId: id,
                actorType: 'admin',
                actorId: admin.id,
                actorLabel: `Admin — ${admin.email}`,
                action: status === 'disabled' ? 'Disabled dashboard' : status === 'active' ? 'Re-enabled dashboard' : `Set status to ${status}`,
            });
        }

        // Notify active dashboards so they immediately reload updated event data & schedule
        await broadcastEventUpdate(id, 'event-data');

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('admin/events/update error:', err);
        return res.status(500).json({ error: err.message || 'Could not update event.' });
    }
}
