import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { requireLmsAdmin } from '../../../_lib/lmsGate.js';
import { sendLmsInvite } from '../../../_lib/lmsEmail.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await requireLmsAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('lms_invites')
            .select('*')
            .eq('cohort_id', admin.cohort.id)
            .order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ invites: data || [] });
    }

    if (req.method === 'POST') {
        const { email, fullName, role = 'learner' } = req.body || {};
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
            return res.status(400).json({ error: 'Valid email address required.' });
        }

        const cleanRole = role === 'admin' ? 'admin' : 'learner';
        const { data: invite, error } = await supabase
            .from('lms_invites')
            .upsert(
                {
                    cohort_id: admin.cohort.id,
                    email: cleanEmail,
                    full_name: String(fullName || '').trim() || null,
                    role: cleanRole,
                    invited_by: admin.user.id,
                    expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
                },
                { onConflict: 'cohort_id,email' },
            )
            .select('*')
            .single();

        if (error || !invite) return res.status(500).json({ error: error?.message || 'Failed to create invite' });

        await sendLmsInvite({
            to: cleanEmail,
            fullName: invite.full_name || undefined,
            cohortName: admin.cohort.name,
            startDate: admin.cohort.start_date,
            inviteToken: invite.invite_token,
            cohortId: admin.cohort.id,
        }).catch((e) => console.error('[admin/lms/invites] Email send failed:', e));

        return res.status(201).json({ invite });
    }

    if (req.method === 'DELETE') {
        const id = String(req.query?.id || req.body?.id || '').trim();
        if (!id) return res.status(400).json({ error: 'Invite id required.' });
        const { error } = await supabase.from('lms_invites').delete().eq('id', id).eq('cohort_id', admin.cohort.id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
