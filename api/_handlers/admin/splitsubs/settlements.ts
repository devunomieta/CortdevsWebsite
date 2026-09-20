import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { createTransferRecipient, initiateTransfer } from '../../../_lib/paystack.js';
import { logSplitsubsActivity } from '../../../_lib/splitsubsAuditLog.js';
import { sendPayoutProcessedToHost } from '../../../_lib/splitsubsEmail.js';

// GET      — pending settlement rows grouped by host, each with a payable total
//            (PRD "Settlement to hosts runs on a schedule... daily batch").
// POST { hostId } — sums that host's pending rows into ONE Paystack transfer,
//            marks them 'processing' immediately and 'paid'/'failed' when the
//            transfer.success/failed webhook lands (payments-webhook.ts).
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        try {
            const { data: pending, error } = await supabase
                .from('ss_settlements')
                .select('*, ss_listings(title)')
                .eq('status', 'pending')
                .order('scheduled_for', { ascending: true });
            if (error) throw error;

            const byHost = new Map<string, { hostId: string; total: number; rows: any[] }>();
            for (const row of pending || []) {
                if (!byHost.has(row.host_id)) byHost.set(row.host_id, { hostId: row.host_id, total: 0, rows: [] });
                const entry = byHost.get(row.host_id)!;
                entry.total += Number(row.amount);
                entry.rows.push(row);
            }

            const grouped = await Promise.all(Array.from(byHost.values()).map(async (entry) => {
                const [{ data: profile }, { data: user }] = await Promise.all([
                    supabase.from('ss_host_profiles').select('bank_account_name, bank_account_number, bank_code, paystack_recipient_code, verification_tier').eq('id', entry.hostId).maybeSingle(),
                    supabase.auth.admin.getUserById(entry.hostId),
                ]);
                return { ...entry, hostEmail: user?.user?.email, payoutReady: Boolean(profile?.bank_account_number && profile?.bank_code), profile };
            }));

            return res.status(200).json({ hosts: grouped });
        } catch (err: any) {
            console.error('admin/splitsubs/settlements get error:', err);
            return res.status(500).json({ error: 'Could not load settlements.' });
        }
    }

    if (req.method === 'POST') {
        const { hostId } = req.body || {};
        if (!hostId) return res.status(400).json({ error: 'hostId is required.' });

        try {
            const { data: rows, error } = await supabase.from('ss_settlements').select('*').eq('host_id', hostId).eq('status', 'pending');
            if (error) throw error;
            if (!rows || rows.length === 0) return res.status(400).json({ error: 'Nothing pending for this host.' });

            const { data: profile } = await supabase.from('ss_host_profiles').select('*').eq('id', hostId).maybeSingle();
            if (!profile?.bank_account_number || !profile?.bank_code) return res.status(400).json({ error: 'This host has no verified payout account yet.' });

            const { data: settings } = await supabase.from('ss_platform_settings').select('paystack_mode').eq('id', 1).single();
            const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
            const rowIds = rows.map((r) => r.id);

            let recipientCode = profile.paystack_recipient_code;
            if (!recipientCode) {
                const recipient = await createTransferRecipient(settings.paystack_mode, {
                    name: profile.bank_account_name, accountNumber: profile.bank_account_number, bankCode: profile.bank_code,
                });
                recipientCode = recipient.recipient_code;
                await supabase.from('ss_host_profiles').update({ paystack_recipient_code: recipientCode }).eq('id', hostId);
            }

            const reference = `ss_payout_${crypto.randomUUID()}`;
            const transfer = await initiateTransfer(settings.paystack_mode, {
                amountKobo: Math.round(total * 100), recipientCode, reason: `SplitSubs settlement (${rows.length} seat${rows.length > 1 ? 's' : ''})`, reference,
            });

            await supabase.from('ss_settlements').update({ status: 'processing', paystack_transfer_code: transfer.transfer_code }).in('id', rowIds);

            const { data: user } = await supabase.auth.admin.getUserById(hostId);
            if (user?.user?.email) {
                await sendPayoutProcessedToHost(user.user.email, { amount: total, listingTitle: rows.length === 1 ? '1 listing' : `${new Set(rows.map((r) => r.listing_id)).size} listing(s)` }).catch((e) => console.error(e));
            }

            await logSplitsubsActivity({
                actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`,
                action: `Initiated payout of ₦${total.toLocaleString()} to host (${rows.length} seat(s))`, targetType: 'host_profile', targetId: hostId,
            });

            return res.status(200).json({ success: true, amount: total, transferCode: transfer.transfer_code });
        } catch (err: any) {
            console.error('admin/splitsubs/settlements post error:', err);
            return res.status(500).json({ error: err.message || 'Could not process payout.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
