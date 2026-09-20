import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { logSplitsubsActivity } from '../../../_lib/splitsubsAuditLog.js';

// GET   — the platform settings singleton (fee rate, insurance pool rate,
//         Paystack live/test + on/off, Direct Transfer on/off, escrow windows).
// PATCH — update any subset. This is the ONLY write path for these values —
// every payment/listing handler reads ss_platform_settings fresh per request,
// so a toggle here takes effect immediately, no deploy needed (PRD:
// "independently toggled on/off from the Admin Dashboard").
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase.from('ss_platform_settings').select('*').eq('id', 1).single();
            if (error) throw error;
            return res.status(200).json({ settings: data });
        } catch (err: any) {
            console.error('admin/splitsubs/settings get error:', err);
            return res.status(500).json({ error: 'Could not load settings.' });
        }
    }

    if (req.method === 'PATCH') {
        const body = req.body || {};
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: admin.id };

        const numericFields: [string, string, number, number][] = [
            ['defaultServiceChargeRate', 'default_service_charge_rate', 0, 0.5],
            ['insurancePoolContributionRate', 'insurance_pool_contribution_rate', 0, 0.1],
            ['escrowHoldHoursLow', 'escrow_hold_hours_low', 1, 720],
            ['escrowHoldHoursMedium', 'escrow_hold_hours_medium', 1, 720],
            ['escrowHoldHoursHigh', 'escrow_hold_hours_high', 1, 720],
            ['newHostSettlementDelayDays', 'new_host_settlement_delay_days', 0, 30],
        ];
        for (const [key, column, min, max] of numericFields) {
            if (body[key] !== undefined) {
                const value = Number(body[key]);
                if (Number.isNaN(value) || value < min || value > max) return res.status(400).json({ error: `${key} must be between ${min} and ${max}.` });
                patch[column] = value;
            }
        }

        if (body.paystackEnabled !== undefined) patch.paystack_enabled = Boolean(body.paystackEnabled);
        if (body.directTransferEnabled !== undefined) patch.direct_transfer_enabled = Boolean(body.directTransferEnabled);
        if (body.paystackMode !== undefined) {
            if (!['live', 'test'].includes(body.paystackMode)) return res.status(400).json({ error: 'paystackMode must be live or test.' });
            patch.paystack_mode = body.paystackMode;
        }

        try {
            const { error } = await supabase.from('ss_platform_settings').update(patch).eq('id', 1);
            if (error) throw error;

            await logSplitsubsActivity({
                actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`,
                action: 'Updated platform settings', targetType: 'platform_settings', targetId: undefined, metadata: patch,
            });

            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('admin/splitsubs/settings patch error:', err);
            return res.status(500).json({ error: err.message || 'Could not update settings.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
