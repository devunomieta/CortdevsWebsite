import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { isNonEmpty, withinLength, LIMITS } from '../../../_lib/validation.js';
import { logSplitsubsActivity } from '../../../_lib/splitsubsAuditLog.js';
import { parseListParams, likeTerm } from '../../../_lib/splitsubsListQuery.js';

function slugify(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// GET ?page=&pageSize=&search=&sort=&order= — full catalog, including
//     inactive services (moderation view), paginated/searchable/sortable.
// POST              — add a service (PRD "Service catalog management").
// PATCH { id, ... }  — edit any field, including toggling status active/inactive.
// This is the ONLY place the catalog changes — public splitsubs/services.ts is read-only.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        try {
            const params = parseListParams(req, { allowedSorts: ['name', 'category', 'status', 'risk_tier', 'created_at'], defaultSort: 'name' });
            let query = supabase.from('ss_services').select('*', { count: 'exact' });
            if (params.search) query = query.or(`name.ilike.${likeTerm(params.search)},category.ilike.${likeTerm(params.search)}`);
            const { data, error, count } = await query.order(params.sort, { ascending: params.order === 'asc' }).range(params.from, params.to);
            if (error) throw error;
            return res.status(200).json({ services: data || [], total: count || 0, page: params.page, pageSize: params.pageSize });
        } catch (err: any) {
            console.error('admin/splitsubs/services get error:', err);
            return res.status(500).json({ error: 'Could not load catalog.' });
        }
    }

    if (req.method === 'POST') {
        const { name, category, maxSeats, defaultChargeRate, riskTier, hostFields, joinerFields, riskNote, iconUrl } = req.body || {};
        if (!isNonEmpty(name) || !isNonEmpty(category) || !maxSeats) {
            return res.status(400).json({ error: 'name, category, and maxSeats are required.' });
        }
        if (!withinLength(name, LIMITS.name)) return res.status(400).json({ error: `Name must be ${LIMITS.name} characters or fewer.` });
        if (Number(maxSeats) < 2 || Number(maxSeats) > 20) return res.status(400).json({ error: 'maxSeats must be between 2 and 20.' });
        const rate = defaultChargeRate !== undefined ? Number(defaultChargeRate) : 0.15;
        if (rate < 0 || rate > 0.5) return res.status(400).json({ error: 'defaultChargeRate must be between 0 and 0.5.' });
        if (riskTier && !['low', 'medium', 'high'].includes(riskTier)) return res.status(400).json({ error: 'riskTier must be low, medium, or high.' });

        try {
            const { data, error } = await supabase
                .from('ss_services')
                .insert([{
                    name: name.trim(), slug: slugify(name), category: category.trim(), max_seats: Number(maxSeats),
                    default_charge_rate: rate, risk_tier: riskTier || 'medium',
                    host_fields: hostFields || [], joiner_fields: joinerFields || [], risk_note: riskNote || null, icon_url: iconUrl || null,
                }])
                .select('id')
                .single();
            if (error) throw error;

            await logSplitsubsActivity({ actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`, action: `Added "${name}" to the service catalog`, targetType: 'service', targetId: data.id });
            return res.status(200).json({ id: data.id });
        } catch (err: any) {
            console.error('admin/splitsubs/services create error:', err);
            return res.status(500).json({ error: err.message || 'Could not add service.' });
        }
    }

    if (req.method === 'PATCH') {
        const { id, name, category, maxSeats, defaultChargeRate, riskTier, hostFields, joinerFields, riskNote, iconUrl, status } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id is required.' });

        try {
            const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (name !== undefined) patch.name = name.trim();
            if (category !== undefined) patch.category = category.trim();
            if (maxSeats !== undefined) patch.max_seats = Number(maxSeats);
            if (defaultChargeRate !== undefined) patch.default_charge_rate = Number(defaultChargeRate);
            if (riskTier !== undefined) patch.risk_tier = riskTier;
            if (hostFields !== undefined) patch.host_fields = hostFields;
            if (joinerFields !== undefined) patch.joiner_fields = joinerFields;
            if (riskNote !== undefined) patch.risk_note = riskNote;
            if (iconUrl !== undefined) patch.icon_url = iconUrl;
            if (status !== undefined) {
                if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'status must be active or inactive.' });
                patch.status = status;
            }

            const { error } = await supabase.from('ss_services').update(patch).eq('id', id);
            if (error) throw error;

            await logSplitsubsActivity({ actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`, action: `Updated service catalog entry`, targetType: 'service', targetId: id, metadata: patch });
            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('admin/splitsubs/services patch error:', err);
            return res.status(500).json({ error: err.message || 'Could not update service.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
