import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { logLmsEvent, requireLmsAdmin } from '../../../_lib/lmsGate.js';
import { sendLmsCredentialsEmail } from '../../../_lib/lmsEmail.js';
import { getLearnAppUrl } from '../../../_lib/appUrl.js';

const ROOT_ADMIN_EMAIL = 'learn@cortdevs.com';
const PLATFORM_ADMIN_EMAILS = new Set(['learn@cortdevs.com', 'projects@cortdevs.com']);

async function isProtectedPlatformAdmin(userId: string, email: string): Promise<boolean> {
    if (PLATFORM_ADMIN_EMAILS.has(email.toLowerCase())) return true;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    return ['Superadmin', 'Admin', 'superadmin', 'admin'].includes(profile?.role || '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await requireLmsAdmin(req, res);
    if (!admin) return;

    // GET: List all accounts in cohort (active, paused/temp-blocked, removed/perm-blocked)
    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('lms_enrollments')
            .select('*')
            .eq('cohort_id', admin.cohort.id)
            .order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ members: data || [] });
    }

    // POST: Admin directly creates a learner/admin access account with email + password
    if (req.method === 'POST') {
        try {
            const { email, password, fullName, jobRole = 'Team Member', role = 'learner', sendEmail = false } = req.body || {};
            const cleanEmail = String(email || '').trim().toLowerCase();
            const cleanName = String(fullName || '').trim();
            const cleanPassword = String(password || '');
            const cleanRole = role === 'admin' ? 'admin' : 'learner';

            if (!cleanEmail || !cleanEmail.includes('@') || !cleanName) {
                return res.status(400).json({ error: 'Full name and valid email address are required.' });
            }
            if (cleanPassword.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters.' });
            }

            let userId: string | undefined;

            const { data: createdUser, error: authErr } = await supabase.auth.admin.createUser({
                email: cleanEmail,
                password: cleanPassword,
                email_confirm: true,
                user_metadata: {
                    full_name: cleanName,
                    lms_cohort_id: admin.cohort.id,
                },
            });

            if (authErr) {
                // If user already exists in Supabase Auth, attach them safely — NEVER overwrite a platform Superadmin's password!
                if (/already|registered|exists/i.test(authErr.message)) {
                    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
                    const existingAuth = listData?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);
                    if (!existingAuth) {
                        return res.status(409).json({ error: authErr.message });
                    }
                    userId = existingAuth.id;
                    const protectedAdmin = await isProtectedPlatformAdmin(existingAuth.id, cleanEmail);
                    if (protectedAdmin && (admin.user.email || '').toLowerCase() !== cleanEmail) {
                        return res.status(403).json({
                            error: 'This email belongs to a protected CortDevs administrator account whose password cannot be overwritten here.',
                        });
                    }
                    const { error: updErr } = await supabase.auth.admin.updateUserById(existingAuth.id, {
                        password: cleanPassword,
                        email_confirm: true,
                    });
                    if (updErr) return res.status(500).json({ error: updErr.message });
                } else {
                    return res.status(400).json({ error: authErr.message });
                }
            } else {
                userId = createdUser?.user?.id;
            }

            if (!userId) {
                return res.status(500).json({ error: 'Failed to resolve user ID.' });
            }

            const { data: enrollment, error: enrErr } = await supabase
                .from('lms_enrollments')
                .upsert(
                    {
                        cohort_id: admin.cohort.id,
                        user_id: userId,
                        email: cleanEmail,
                        full_name: cleanName,
                        job_role: String(jobRole || 'Team Member').trim(),
                        role: cleanRole,
                        status: 'active',
                        onboarding_completed: true,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'cohort_id,user_id' },
                )
                .select('*')
                .single();

            if (enrErr || !enrollment) {
                return res.status(500).json({ error: enrErr?.message || 'Failed to save enrollment.' });
            }

            await logLmsEvent({
                cohortId: admin.cohort.id,
                userId,
                eventType: 'account_created_by_admin',
                metadata: { createdBy: admin.user.id, role: cleanRole },
            });

            let emailed = false;
            if (sendEmail) {
                emailed = await sendLmsCredentialsEmail({
                    to: cleanEmail,
                    fullName: cleanName,
                    password: cleanPassword,
                    cohortName: admin.cohort.name,
                    startDate: admin.cohort.start_date,
                    isPasswordReset: false,
                    cohortId: admin.cohort.id,
                    userId,
                });
            }

            return res.status(201).json({
                member: enrollment,
                emailed,
                credentials: {
                    loginUrl: `${getLearnAppUrl()}/login`,
                    email: cleanEmail,
                    password: cleanPassword,
                    fullName: cleanName,
                },
            });
        } catch (err: any) {
            console.error('[admin/lms/members POST] Error:', err);
            return res.status(500).json({ error: err?.message || 'Account creation failed' });
        }
    }

    // PATCH: Change password, send credentials email, or temp/perm block & unblock access
    if (req.method === 'PATCH') {
        try {
            const { action, targetUserId, password, status, sendEmail = false } = req.body || {};
            if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required.' });

            const { data: member } = await supabase
                .from('lms_enrollments')
                .select('*')
                .eq('cohort_id', admin.cohort.id)
                .eq('user_id', targetUserId)
                .maybeSingle();

            if (!member) return res.status(404).json({ error: 'Member not found in this cohort.' });

            const targetIsRootAdmin = member.email.toLowerCase() === ROOT_ADMIN_EMAIL;
            const targetIsProtectedPlatformAdmin = await isProtectedPlatformAdmin(targetUserId, member.email);
            const actorIsRootAdmin = (admin.user.email || '').toLowerCase() === ROOT_ADMIN_EMAIL;

            if (action === 'reset_password') {
                if ((targetIsRootAdmin || targetIsProtectedPlatformAdmin) && !actorIsRootAdmin && targetUserId !== admin.user.id) {
                    return res.status(403).json({
                        error: 'Protected administrator accounts cannot have their password changed by other admins.',
                    });
                }
                const cleanPassword = String(password || '');
                if (cleanPassword.length < 8) {
                    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
                }
                const { error: updErr } = await supabase.auth.admin.updateUserById(targetUserId, {
                    password: cleanPassword,
                });
                if (updErr) return res.status(500).json({ error: updErr.message });

                await logLmsEvent({
                    cohortId: admin.cohort.id,
                    userId: targetUserId,
                    eventType: 'password_changed_by_admin',
                    metadata: { changedBy: admin.user.id },
                });

                let emailed = false;
                if (sendEmail) {
                    emailed = await sendLmsCredentialsEmail({
                        to: member.email,
                        fullName: member.full_name,
                        password: cleanPassword,
                        cohortName: admin.cohort.name,
                        startDate: admin.cohort.start_date,
                        isPasswordReset: true,
                        cohortId: admin.cohort.id,
                        userId: targetUserId,
                    });
                }

                return res.status(200).json({
                    ok: true,
                    emailed,
                    credentials: {
                        loginUrl: `${getLearnAppUrl()}/login`,
                        email: member.email,
                        password: cleanPassword,
                        fullName: member.full_name,
                    },
                });
            }

            if (action === 'set_role') {
                const nextRole = req.body?.role;
                if (nextRole !== 'admin' && nextRole !== 'learner') {
                    return res.status(400).json({ error: 'role must be admin or learner.' });
                }
                if (targetIsRootAdmin) {
                    return res.status(403).json({
                        error: 'The primary admin account (learn@cortdevs.com) cannot have its admin role removed.',
                    });
                }
                if (targetUserId === admin.user.id && nextRole !== 'admin') {
                    return res.status(400).json({ error: 'You cannot remove your own admin role.' });
                }

                const { data: updated, error: roleErr } = await supabase
                    .from('lms_enrollments')
                    .update({ role: nextRole, updated_at: new Date().toISOString() })
                    .eq('id', member.id)
                    .select('*')
                    .single();

                if (roleErr) return res.status(500).json({ error: roleErr.message });

                await logLmsEvent({
                    cohortId: admin.cohort.id,
                    userId: targetUserId,
                    eventType: nextRole === 'admin' ? 'promoted_to_admin' : 'demoted_to_learner',
                    metadata: { changedBy: admin.user.id },
                });

                return res.status(200).json({ ok: true, member: updated });
            }

            if (action === 'send_credentials') {
                const cleanPassword = String(password || '');
                if (!cleanPassword) return res.status(400).json({ error: 'Password required to send credentials.' });
                const emailed = await sendLmsCredentialsEmail({
                    to: member.email,
                    fullName: member.full_name,
                    password: cleanPassword,
                    cohortName: admin.cohort.name,
                    startDate: admin.cohort.start_date,
                    isPasswordReset: Boolean(req.body?.isPasswordReset),
                    cohortId: admin.cohort.id,
                    userId: targetUserId,
                });
                return res.status(200).json({ ok: true, emailed });
            }

            if (action === 'set_status') {
                if (!['active', 'paused', 'removed'].includes(status)) {
                    return res.status(400).json({ error: 'status must be active, paused (temp block), or removed (perm block).' });
                }
                if (targetIsRootAdmin) {
                    return res.status(403).json({
                        error: 'The primary admin account (learn@cortdevs.com) is protected and cannot be blocked or removed.',
                    });
                }
                if (targetUserId === admin.user.id && status !== 'active') {
                    return res.status(400).json({ error: 'You cannot block your own administrator account.' });
                }

                const { data: updated, error: updErr } = await supabase
                    .from('lms_enrollments')
                    .update({ status, updated_at: new Date().toISOString() })
                    .eq('id', member.id)
                    .select('*')
                    .single();

                if (updErr) return res.status(500).json({ error: updErr.message });

                // Note: Access revocation is strictly enforced at the CortDevs Learn layer
                // (requireLmsMember blocks 'paused' and 'removed' with 403) rather than applying
                // a global Supabase Auth ban that could accidentally lock a user out of SplitSubs/Events.

                await logLmsEvent({
                    cohortId: admin.cohort.id,
                    userId: targetUserId,
                    eventType:
                        status === 'paused'
                            ? 'access_temp_blocked'
                            : status === 'removed'
                              ? 'access_perm_blocked'
                              : 'access_restored',
                    metadata: { changedBy: admin.user.id },
                });

                return res.status(200).json({ ok: true, member: updated });
            }

            return res.status(400).json({ error: 'Unknown action.' });
        } catch (err: any) {
            console.error('[admin/lms/members PATCH] Error:', err);
            return res.status(500).json({ error: err?.message || 'Update failed' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
