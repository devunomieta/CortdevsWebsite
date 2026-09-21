import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { verifyAuth } from '../../_lib/auth.js';
import { resolveAccountNumber, listBanks } from '../../_lib/paystack.js';
import { logSplitsubsActivity } from '../../_lib/splitsubsAuditLog.js';
import { isNonEmpty } from '../../_lib/validation.js';

function normalizeNameTokens(name: string): string[] {
    return name.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(Boolean);
}

// Loose on purpose: Nigerian bank accounts and KYC records don't always agree
// on name order ("OKONKWO CHIOMA" vs "CHIOMA OKONKWO") or on including a
// middle name, so this checks for shared first/last-name tokens rather than
// exact string equality. A single-token name (rare, but possible) must match
// exactly since there's nothing else to corroborate it against.
function namesLikelyMatch(a: string, b: string): boolean {
    const tokensA = new Set(normalizeNameTokens(a));
    const tokensB = new Set(normalizeNameTokens(b));
    if (tokensA.size === 0 || tokensB.size === 0) return false;
    const [smaller, larger] = tokensA.size <= tokensB.size ? [tokensA, tokensB] : [tokensB, tokensA];
    let matches = 0;
    for (const t of smaller) if (larger.has(t)) matches++;
    return smaller.size === 1 ? matches === 1 : matches >= 2;
}

// GET ?banks=1        — Paystack's bank list, for the payout-account form's dropdown.
// GET (default)        — the signed-in user's host profile (ratings, verification tier, bank details).
// PATCH { bankCode, accountNumber } — resolves + saves a payout account, gated
// on approved KYC (splitsubs/profile.ts) with the resolved account name
// checked against the KYC legal name — the PRD's "Mandatory Paystack
// account-name resolution before first payout" plus the identity check that
// makes that resolution actually mean something.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = await verifyAuth(req, res);
    if (!user) return;

    if (req.method === 'GET' && req.query.banks) {
        try {
            const { data: settings } = await supabase.from('ss_platform_settings').select('paystack_mode').eq('id', 1).single();
            const banks = await listBanks(settings.paystack_mode);
            return res.status(200).json({ banks });
        } catch (err: any) {
            console.error('splitsubs/host-profile banks error:', err);
            return res.status(500).json({ error: 'Could not load bank list.' });
        }
    }

    if (req.method === 'GET') {
        try {
            const { data: profile } = await supabase.from('ss_host_profiles').select('*').eq('id', user.id).maybeSingle();
            return res.status(200).json({
                profile: profile || {
                    id: user.id, verification_tier: 'basic', rating_sum: 0, rating_count: 0,
                    strikes: 0, completed_splits: 0, bank_account_name: null, bank_account_number: null, bank_code: null,
                    kyc_status: 'unsubmitted',
                },
            });
        } catch (err: any) {
            console.error('splitsubs/host-profile get error:', err);
            return res.status(500).json({ error: 'Could not load your profile.' });
        }
    }

    if (req.method === 'PATCH') {
        const { bankCode, accountNumber } = req.body || {};
        if (!isNonEmpty(bankCode) || !isNonEmpty(accountNumber)) return res.status(400).json({ error: 'bankCode and accountNumber are required.' });

        try {
            const { data: profile } = await supabase.from('ss_host_profiles').select('kyc_status, legal_name').eq('id', user.id).maybeSingle();
            if (!profile || profile.kyc_status !== 'approved') {
                return res.status(400).json({ error: 'Complete identity verification (KYC) in your Profile before adding a payout account.' });
            }

            const { data: settings } = await supabase.from('ss_platform_settings').select('paystack_mode').eq('id', 1).single();
            const resolved = await resolveAccountNumber(settings.paystack_mode, accountNumber, bankCode);

            if (!namesLikelyMatch(resolved.account_name, profile.legal_name || '')) {
                await logSplitsubsActivity({
                    actorType: 'host', actorId: user.id, actorLabel: `${user.email}`,
                    action: `Blocked: bank account name "${resolved.account_name}" doesn't match KYC name "${profile.legal_name}"`,
                    targetType: 'host_profile', targetId: user.id,
                });
                return res.status(400).json({ error: `That account is registered to "${resolved.account_name}", which doesn't match your verified name. Payout accounts must be in your own name.` });
            }

            await supabase.from('ss_host_profiles').upsert([{
                id: user.id,
                email: user.email,
                bank_account_name: resolved.account_name,
                bank_account_number: accountNumber,
                bank_code: bankCode,
                paystack_recipient_code: null, // stale after a bank-detail change — settlements.ts/wallet.ts recreate it lazily
                updated_at: new Date().toISOString(),
            }], { onConflict: 'id' });

            await logSplitsubsActivity({
                actorType: 'host', actorId: user.id, actorLabel: `Host — ${user.email}`,
                action: `Verified payout account (${resolved.account_name})`, targetType: 'host_profile', targetId: user.id,
            });

            return res.status(200).json({ accountName: resolved.account_name });
        } catch (err: any) {
            console.error('splitsubs/host-profile patch error:', err);
            return res.status(400).json({ error: err.message || 'Could not verify that account — check the number and bank.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
