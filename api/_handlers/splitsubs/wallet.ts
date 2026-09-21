import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { getWalletSummary } from '../../_lib/splitsubsWallet.js';
import { computePayoutSplit } from '../../_lib/splitsubsFees.js';
import { createTransferRecipient, initiateTransfer } from '../../_lib/paystack.js';
import { logSplitsubsActivity } from '../../_lib/splitsubsAuditLog.js';
import { sendPayoutProcessedToHost } from '../../_lib/splitsubsEmail.js';

// GET  — the signed-in host's wallet: balance / available / locked, plus
//        recent transaction history (PRD-extension: escrow release credits a
//        wallet now, not a direct bank payout — see splitsubsPayments.ts).
// POST { action: 'withdraw', amount } — self-service withdrawal of any
//        amount up to the *available* balance (the 80%-of-cycle-eligible,
//        non-disputed portion). The payout charge is deducted from the
//        withdrawn amount, not from the plan cost — hosts pay nothing else.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const host = await verifyAuth(req, res);
    if (!host) return;

    if (req.method === 'GET') {
        try {
            const [summary, { data: transactions }] = await Promise.all([
                getWalletSummary(host.id),
                supabase.from('ss_wallet_transactions').select('*').eq('host_id', host.id).order('created_at', { ascending: false }).limit(50),
            ]);
            return res.status(200).json({ wallet: summary, transactions: transactions || [] });
        } catch (err: any) {
            console.error('splitsubs/wallet get error:', err);
            return res.status(500).json({ error: 'Could not load your wallet.' });
        }
    }

    if (req.method === 'POST') {
        const { action, amount } = req.body || {};
        if (action !== 'withdraw') return res.status(400).json({ error: 'Unknown action.' });

        const requested = Number(amount);
        if (!requested || requested <= 0) return res.status(400).json({ error: 'Enter a valid amount.' });

        try {
            const summary = await getWalletSummary(host.id);
            if (requested > summary.available) {
                return res.status(400).json({ error: `You can only withdraw up to your available balance (₦${summary.available.toLocaleString()}). The rest is still within its hold window.` });
            }

            const { data: profile } = await supabase.from('ss_host_profiles').select('*').eq('id', host.id).maybeSingle();
            if (!profile?.bank_account_number || !profile?.bank_code) {
                return res.status(400).json({ error: 'Add a verified payout account first — see Payout Account in your dashboard.' });
            }

            const { data: settings } = await supabase.from('ss_platform_settings').select('paystack_mode, payout_charge_rate').eq('id', 1).single();
            const { fee, net } = computePayoutSplit(requested, settings.payout_charge_rate);
            if (net <= 0) return res.status(400).json({ error: 'That amount is too small after the payout charge — try a larger withdrawal.' });

            let recipientCode = profile.paystack_recipient_code;
            if (!recipientCode) {
                const recipient = await createTransferRecipient(settings.paystack_mode, {
                    name: profile.bank_account_name, accountNumber: profile.bank_account_number, bankCode: profile.bank_code,
                });
                recipientCode = recipient.recipient_code;
                await supabase.from('ss_host_profiles').update({ paystack_recipient_code: recipientCode }).eq('id', host.id);
            }

            const reference = `ss_wd_${crypto.randomUUID()}`;
            const transfer = await initiateTransfer(settings.paystack_mode, {
                amountKobo: Math.round(net * 100), recipientCode, reason: 'SplitSubs wallet withdrawal', reference,
            });

            await supabase.from('ss_wallet_transactions').insert([{
                host_id: host.id,
                type: 'debit',
                amount: requested,
                fee_amount: fee,
                source: 'withdrawal',
                withdrawal_transfer_code: transfer.transfer_code,
                withdrawal_status: 'processing',
            }]);

            await sendPayoutProcessedToHost(host.email!, { amount: net }).catch((e) => console.error(e));

            await logSplitsubsActivity({
                actorType: 'host', actorId: host.id, actorLabel: `Host — ${host.email}`,
                action: `Requested withdrawal of ₦${requested.toLocaleString()} (₦${net.toLocaleString()} net after ₦${fee.toLocaleString()} payout charge)`,
                targetType: 'host_profile', targetId: host.id,
            });

            return res.status(200).json({ success: true, net, fee, transferCode: transfer.transfer_code });
        } catch (err: any) {
            console.error('splitsubs/wallet withdraw error:', err);
            return res.status(500).json({ error: err.message || 'Could not process withdrawal.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
