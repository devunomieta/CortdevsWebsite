import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';
import { logSplitsubsActivity } from '../../../_lib/splitsubsAuditLog.js';
import { sendHostVerificationStatus } from '../../../_lib/splitsubsEmail.js';
import { parseListParams, likeTerm } from '../../../_lib/splitsubsListQuery.js';

// GET ?page=&pageSize=&search=&sort=&order= — every host profile (fraud
//     review / verification queue: "review new-host listings... verify
//     bank-account-name matches, approve/reject/flag accounts"). `search`
//     matches the cached email column (kept in sync on every profile write —
//     see host-listings.ts / host-profile.ts / ratings.ts); a profile from
//     before that column existed self-heals its email on this read.
// PATCH { id, verificationTier?, isBanned?, strikeDelta? }
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        try {
            const params = parseListParams(req, { allowedSorts: ['created_at', 'completed_splits', 'strikes', 'verification_tier', 'email'], defaultSort: 'created_at' });
            let query = supabase.from('ss_host_profiles').select('*', { count: 'exact' });
            if (params.search) query = query.ilike('email', likeTerm(params.search));
            const { data: profiles, error, count } = await query.order(params.sort, { ascending: params.order === 'asc' }).range(params.from, params.to);
            if (error) throw error;

            const enriched = await Promise.all((profiles || []).map(async (p) => {
                if (p.email) return p;
                const { data: u } = await supabase.auth.admin.getUserById(p.id);
                const email = u?.user?.email || null;
                if (email) await supabase.from('ss_host_profiles').update({ email }).eq('id', p.id);
                return { ...p, email };
            }));

            return res.status(200).json({ hosts: enriched, total: count || 0, page: params.page, pageSize: params.pageSize });
        } catch (err: any) {
            console.error('admin/splitsubs/hosts get error:', err);
            return res.status(500).json({ error: 'Could not load hosts.' });
        }
    }

    if (req.method === 'PATCH') {
        const { id, verificationTier, isBanned, strikeDelta } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id is required.' });

        try {
            const { data: profile } = await supabase.from('ss_host_profiles').select('*').eq('id', id).maybeSingle();
            if (!profile) return res.status(404).json({ error: 'Host profile not found.' });

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
