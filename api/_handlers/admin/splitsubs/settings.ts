import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { encryptSecret } from '../../../_lib/splitsubsCrypto.js';
import { logSplitsubsActivity } from '../../../_lib/splitsubsAuditLog.js';

// GET   — the platform settings singleton (fee rate, insurance pool rate,
//         Paystack live/test + on/off, Direct Transfer on/off, escrow windows).
//         The Paystack secret keys themselves are never returned — only
//         whether one is configured (DB-stored or falling back to the env
//         var) — since this response reaches the browser.
// PATCH — update any subset. This is the ONLY write path for these values —
// every payment/listing handler reads ss_platform_settings fresh per request,
// so a toggle here takes effect immediately, no deploy needed (PRD:
// "independently toggled on/off from the Admin Dashboard"). Paystack keys:
// send a non-empty string to set/replace one, an empty string to clear it
// (falls back to the env var), or omit the field to leave it untouched.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase.from('ss_platform_settings').select('*').eq('id', 1).single();
            if (error) throw error;

            const { paystack_live_secret_key_enc, paystack_test_secret_key_enc, ...rest } = data;
            return res.status(200).json({
                settings: {
                    ...rest,
                    paystack_live_key_configured: Boolean(paystack_live_secret_key_enc) || Boolean(process.env.PAYSTACK_LIVE_SECRET_KEY),
                    paystack_live_key_source: paystack_live_secret_key_enc ? 'admin' : process.env.PAYSTACK_LIVE_SECRET_KEY ? 'env' : 'none',
                    paystack_test_key_configured: Boolean(paystack_test_secret_key_enc) || Boolean(process.env.PAYSTACK_TEST_SECRET_KEY),
                    paystack_test_key_source: paystack_test_secret_key_enc ? 'admin' : process.env.PAYSTACK_TEST_SECRET_KEY ? 'env' : 'none',
                },
            });
        } catch (err: any) {
            console.error('admin/splitsubs/settings get error:', err);
            return res.status(500).json({ error: 'Could not load settings.' });
        }
    }

    if (req.method === 'PATCH') {
        const body = req.body || {};
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: admin.id };
        const changedLabels: string[] = [];

        const numericFields: [string, string, number, number][] = [
            ['defaultServiceChargeRate', 'default_service_charge_rate', 0, 0.5],
            ['insurancePoolContributionRate', 'insurance_pool_contribution_rate', 0, 0.1],
            ['escrowHoldHoursLow', 'escrow_hold_hours_low', 1, 720],
            ['escrowHoldHoursMedium', 'escrow_hold_hours_medium', 1, 720],
            ['escrowHoldHoursHigh', 'escrow_hold_hours_high', 1, 720],
            ['newHostSettlementDelayDays', 'new_host_settlement_delay_days', 0, 30],
            ['payoutChargeRate', 'payout_charge_rate', 0, 0.2],
            ['payoutMinCyclePct', 'payout_min_cycle_pct', 0, 1],
        ];
        for (const [key, column, min, max] of numericFields) {
            if (body[key] !== undefined) {
                const value = Number(body[key]);
                if (Number.isNaN(value) || value < min || value > max) return res.status(400).json({ error: `${key} must be between ${min} and ${max}.` });
                patch[column] = value;
                changedLabels.push(column);
            }
        }

        if (body.paystackEnabled !== undefined) { patch.paystack_enabled = Boolean(body.paystackEnabled); changedLabels.push('paystack_enabled'); }
        if (body.directTransferEnabled !== undefined) { patch.direct_transfer_enabled = Boolean(body.directTransferEnabled); changedLabels.push('direct_transfer_enabled'); }
        if (body.paystackMode !== undefined) {
            if (!['live', 'test'].includes(body.paystackMode)) return res.status(400).json({ error: 'paystackMode must be live or test.' });
            patch.paystack_mode = body.paystackMode;
            changedLabels.push('paystack_mode');
        }

        if (body.paystackLiveSecretKey !== undefined) {
            patch.paystack_live_secret_key_enc = body.paystackLiveSecretKey.trim() ? encryptSecret(body.paystackLiveSecretKey.trim()) : null;
            changedLabels.push('paystack_live_secret_key');
        }
        if (body.paystackTestSecretKey !== undefined) {
            patch.paystack_test_secret_key_enc = body.paystackTestSecretKey.trim() ? encryptSecret(body.paystackTestSecretKey.trim()) : null;
            changedLabels.push('paystack_test_secret_key');
        }

        try {
            const { error } = await supabase.from('ss_platform_settings').update(patch).eq('id', 1);
            if (error) throw error;

            await logSplitsubsActivity({
                actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`,
                action: `Updated platform settings (${changedLabels.join(', ') || 'no changes'})`, targetType: 'platform_settings', targetId: undefined,
            });

            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('admin/splitsubs/settings patch error:', err);
            return res.status(500).json({ error: err.message || 'Could not update settings.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
