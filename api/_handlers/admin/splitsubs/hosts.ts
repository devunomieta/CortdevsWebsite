import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { decryptSecret } from '../../../_lib/splitsubsCrypto.js';
import { logSplitsubsActivity } from '../../../_lib/splitsubsAuditLog.js';
import { sendHostVerificationStatus } from '../../../_lib/splitsubsEmail.js';
import { withinLength, LIMITS } from '../../../_lib/validation.js';
import { parseListParams, likeTerm } from '../../../_lib/splitsubsListQuery.js';

// GET ?page=&pageSize=&search=&sort=&order= — every user profile (fraud
//     review / KYC + verification queue). The KYC ID number is never
//     included here — see the ?id=&revealKyc=1 branch, which logs the reveal.
// GET ?id=&revealKyc=1 — one profile with its KYC ID number decrypted, for
//     the admin actually reviewing a submission. Logged, same pattern as
//     event-credential reveals elsewhere in this app.
// PATCH { id, verificationTier?, isBanned?, strikeDelta? } — existing controls.
// PATCH { id, kycAction: 'approve'|'reject', kycRejectionReason? } — resolves
//     a pending KYC submission. Approval sets verification_tier to
//     'id_verified' — the tier a bank account can then be added under
//     (splitsubs/host-profile.ts requires kyc_status === 'approved').
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET' && req.query.id) {
        try {
            const { data: profile } = await supabase.from('ss_host_profiles').select('*').eq('id', String(req.query.id)).maybeSingle();
            if (!profile) return res.status(404).json({ error: 'Profile not found.' });

            const { kyc_id_number_enc, kyc_document_path, ...rest } = profile;
            let kycIdNumber: string | null = null;
            let kycDocumentUrl: string | null = null;
            if (req.query.revealKyc && kyc_id_number_enc) {
                kycIdNumber = decryptSecret(kyc_id_number_enc);
                if (kyc_document_path) {
                    const { data: signed } = await supabase.storage.from('ss-kyc-docs').createSignedUrl(kyc_document_path, 300);
                    kycDocumentUrl = signed?.signedUrl || null;
                }
                await logSplitsubsActivity({
                    actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`,
                    action: `Viewed KYC ${rest.kyc_id_type?.toUpperCase()} for ${rest.email || rest.id}`, targetType: 'host_profile', targetId: rest.id,
                });
            }
            return res.status(200).json({ profile: rest, kycIdNumber, kycDocumentUrl });
        } catch (err: any) {
            console.error('admin/splitsubs/hosts get-one error:', err);
            return res.status(500).json({ error: 'Could not load profile.' });
        }
    }

    if (req.method === 'GET') {
        try {
            const params = parseListParams(req, { allowedSorts: ['created_at', 'completed_splits', 'strikes', 'verification_tier', 'email', 'kyc_status'], defaultSort: 'created_at' });
            let query = supabase.from('ss_host_profiles').select('*', { count: 'exact' });
            if (params.search) query = query.ilike('email', likeTerm(params.search));
            if (req.query.kycStatus) query = query.eq('kyc_status', String(req.query.kycStatus));
            const { data: profiles, error, count } = await query.order(params.sort, { ascending: params.order === 'asc' }).range(params.from, params.to);
            if (error) throw error;

            const enriched = await Promise.all((profiles || []).map(async (p) => {
                const { kyc_id_number_enc, kyc_document_path, ...rest } = p;
                if (rest.email) return rest;
                const { data: u } = await supabase.auth.admin.getUserById(rest.id);
                const email = u?.user?.email || null;
                if (email) await supabase.from('ss_host_profiles').update({ email }).eq('id', rest.id);
                return { ...rest, email };
            }));

            return res.status(200).json({ hosts: enriched, total: count || 0, page: params.page, pageSize: params.pageSize });
        } catch (err: any) {
            console.error('admin/splitsubs/hosts get error:', err);
            return res.status(500).json({ error: 'Could not load hosts.' });
        }
    }

    if (req.method === 'PATCH') {
        const { id, verificationTier, isBanned, strikeDelta, kycAction, kycRejectionReason } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id is required.' });

        try {
            const { data: profile } = await supabase.from('ss_host_profiles').select('*').eq('id', id).maybeSingle();
            if (!profile) return res.status(404).json({ error: 'Profile not found.' });

            if (kycAction !== undefined) {
                if (!['approve', 'reject'].includes(kycAction)) return res.status(400).json({ error: 'kycAction must be approve or reject.' });
                if (profile.kyc_status !== 'pending') return res.status(400).json({ error: 'This profile has no pending KYC submission.' });
                if (kycAction === 'reject' && (!kycRejectionReason || !withinLength(kycRejectionReason, LIMITS.message))) {
                    return res.status(400).json({ error: `A rejection reason is required (${LIMITS.message} characters or fewer).` });
                }

                const kycPatch: Record<string, unknown> = {
                    kyc_status: kycAction === 'approve' ? 'approved' : 'rejected',
                    kyc_reviewed_at: new Date().toISOString(),
                    kyc_reviewed_by: admin.id,
                    kyc_rejection_reason: kycAction === 'reject' ? kycRejectionReason : null,
                    updated_at: new Date().toISOString(),
                };
                if (kycAction === 'approve') kycPatch.verification_tier = 'id_verified';

                const { error } = await supabase.from('ss_host_profiles').update(kycPatch).eq('id', id);
                if (error) throw error;

                const { data: u } = await supabase.auth.admin.getUserById(id);
                if (u?.user?.email) {
                    await sendHostVerificationStatus(u.user.email, { tier: 'id_verified', approved: kycAction === 'approve' }).catch((e) => console.error(e));
                }

                await logSplitsubsActivity({
                    actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`,
                    action: `${kycAction === 'approve' ? 'Approved' : 'Rejected'} KYC for ${profile.email || id}${kycAction === 'reject' ? `: ${kycRejectionReason}` : ''}`,
                    targetType: 'host_profile', targetId: id,
                });

                return res.status(200).json({ success: true });
            }

            const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (verificationTier !== undefined) {
                if (!['basic', 'bank_verified', 'id_verified'].includes(verificationTier)) return res.status(400).json({ error: 'Invalid verification tier.' });
                patch.verification_tier = verificationTier;
            }
            if (isBanned !== undefined) patch.is_banned = Boolean(isBanned);
            if (strikeDelta !== undefined) patch.strikes = Math.max(0, profile.strikes + Number(strikeDelta));

            const { error } = await supabase.from('ss_host_profiles').update(patch).eq('id', id);
            if (error) throw error;

            if (verificationTier !== undefined) {
                const { data: u } = await supabase.auth.admin.getUserById(id);
                if (u?.user?.email) {
                    await sendHostVerificationStatus(u.user.email, { tier: verificationTier, approved: verificationTier !== 'basic' }).catch((e) => console.error(e));
                }
            }

            await logSplitsubsActivity({
                actorType: 'admin', actorId: admin.id, actorLabel: `Admin — ${admin.email}`,
                action: `Updated host profile (${Object.keys(patch).filter((k) => k !== 'updated_at').join(', ')})`,
                targetType: 'host_profile', targetId: id, metadata: patch,
            });

            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('admin/splitsubs/hosts patch error:', err);
            return res.status(500).json({ error: err.message || 'Could not update host.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
