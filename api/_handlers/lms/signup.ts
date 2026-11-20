import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { sendLmsWelcome } from '../../_lib/lmsEmail.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        // Validate an invite token for the signup UI before submitting
        const token = String(req.query?.token || '').trim();
        const email = String(req.query?.email || '').trim().toLowerCase();
        if (!token && !email) {
            return res.status(400).json({ error: 'Invite token or email required.' });
        }

        let query = supabase.from('lms_invites').select('id, email, full_name, role, accepted_at, expires_at, lms_cohorts(id, name, start_date)');
        if (token) {
            query = query.eq('invite_token', token);
        } else {
            query = query.ilike('email', email);
        }

        const { data: invite } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!invite) {
            return res.status(404).json({ error: 'No valid cohort invite found for this link or email.' });
        }
        if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now() && !invite.accepted_at) {
            return res.status(410).json({ error: 'This invite has expired. Ask your team lead for a fresh invite.' });
        }
        return res.status(200).json({
            valid: true,
            email: invite.email,
            fullName: invite.full_name || '',
            role: invite.role,
            alreadyAccepted: Boolean(invite.accepted_at),
            cohort: invite.lms_cohorts,
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password, fullName, jobRole, inviteToken, timezone, reminderHour, weeklyCommitmentHours } = req.body || {};
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanName = String(fullName || '').trim();

        if (!cleanEmail || !password || password.length < 8 || !cleanName) {
            return res.status(400).json({ error: 'Email, full name, and a password (min 8 chars) are required.' });
        }

        // Verify invite (either by token OR whitelisted email)
        let inviteQuery = supabase.from('lms_invites').select('*, lms_cohorts(id, name)');
        if (inviteToken) {
            inviteQuery = inviteQuery.eq('invite_token', String(inviteToken).trim());
        } else {
            inviteQuery = inviteQuery.ilike('email', cleanEmail);
        }
        const { data: invite } = await inviteQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();

        if (!invite) {
            return res.status(403).json({
                error: 'Gated access: your email is not on the invite list. Ask your team lead to invite you first.',
            });
        }

        if (invite.email.toLowerCase() !== cleanEmail) {
            return res.status(403).json({
                error: `This invite belongs to ${invite.email}. Please sign up with that email address.`,
            });
        }

        // Create Supabase Auth user (email_confirm: true since invite link already verified ownership)
        const { data: createdUser, error: authErr } = await supabase.auth.admin.createUser({
            email: cleanEmail,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: cleanName,
                lms_cohort_id: invite.cohort_id,
            },
        });

        let userId = createdUser?.user?.id;
        if (authErr) {
            // If user already exists on CortDevs auth, allow linking via normal login instead
            if (/already|registered|exists/i.test(authErr.message)) {
                return res.status(409).json({
                    error: 'An account with this email already exists. Sign in on the Login page — your cohort access will activate automatically.',
                });
            }
            return res.status(400).json({ error: authErr.message });
        }

        if (!userId) {
            return res.status(500).json({ error: 'Unable to create user account.' });
        }

        // Create enrollment
        const { error: enrollErr } = await supabase.from('lms_enrollments').upsert(
            {
                cohort_id: invite.cohort_id,
                user_id: userId,
                email: cleanEmail,
                full_name: cleanName,
                job_role: String(jobRole || 'Team Member').trim(),
                role: invite.role || 'learner',
                timezone: String(timezone || 'Africa/Lagos'),
                reminder_hour: Number.isFinite(Number(reminderHour)) ? Math.max(0, Math.min(23, Number(reminderHour))) : 8,
                weekly_commitment_hours: Number.isFinite(Number(weeklyCommitmentHours)) ? Number(weeklyCommitmentHours) : 7.5,
                onboarding_completed: true,
            },
            { onConflict: 'cohort_id,user_id' },
        );

        if (enrollErr) {
            return res.status(500).json({ error: 'Account created, but enrollment failed.', details: enrollErr.message });
        }

        await supabase.from('lms_invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id);

        const cohortName = (invite.lms_cohorts as any)?.name || 'Microsoft AI Product Manager Cohort';
        await sendLmsWelcome({
            to: cleanEmail,
            fullName: cleanName,
            cohortName,
            cohortId: invite.cohort_id,
            userId,
        }).catch((e) => console.error('[lms/signup] Welcome email error:', e));

        return res.status(201).json({
            ok: true,
            message: 'Account created! Signing you in...',
        });
    } catch (err: any) {
        console.error('[lms/signup] Error:', err);
        return res.status(500).json({ error: err?.message || 'Signup failed' });
    }
}
