import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { getAppBaseUrl } from '../../_lib/appUrl.js';
import { sendSignupConfirmation } from '../../_lib/splitsubsEmail.js';
import { isValidEmail } from '../../_lib/validation.js';

const RESEND_COOLDOWN_MS = 45 * 1000;

// POST { email, password }                — new account: creates the user
//        (unconfirmed) and sends our own branded confirmation email via
//        Resend, in place of Supabase's default one. Bypasses
//        supabase.auth.signUp() entirely — that's what was sending the
//        generic-sender, no-OTP, wrong-domain-link email — using the admin
//        API to both create the user and generate the link/OTP in one call.
// POST { action: 'resend', email, password } — re-sends the same email for an
//        already-created-but-unconfirmed account. `password` is required by
//        Supabase's generateLink API for type 'signup' regardless of whether
//        the user already exists (it's the same call either way), so the
//        frontend carries it in memory from the original signup form —
//        never re-typed, never put in a URL.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, password, action } = req.body || {};
    if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });
    if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    try {
        const { data: profile } = await supabase
            .from('ss_host_profiles')
            .select('id, last_signup_email_sent_at')
            .eq('email', email)
            .maybeSingle();

        if (profile?.last_signup_email_sent_at) {
            const elapsed = Date.now() - new Date(profile.last_signup_email_sent_at).getTime();
            if (elapsed < RESEND_COOLDOWN_MS) {
                return res.status(429).json({ error: `Please wait ${Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)}s before requesting another code.` });
            }
        }

        const { data, error } = await supabase.auth.admin.generateLink({
            type: 'signup',
            email,
            password,
            options: { redirectTo: `${getAppBaseUrl('https://splitsubs.cortdevs.com')}/dashboard` },
        });

        if (error) {
            const alreadyRegistered = /already registered|already exists|already been registered/i.test(error.message || '');
            if (alreadyRegistered) {
                return res.status(409).json({ error: action === 'resend' ? 'This account is already confirmed — sign in instead.' : 'An account with this email already exists — sign in instead.' });
            }
            throw error;
        }
        if (!data.properties?.action_link || !data.properties?.email_otp) {
            throw new Error('Could not generate a confirmation link.');
        }

        await sendSignupConfirmation(email, { confirmUrl: data.properties.action_link, otp: data.properties.email_otp });

        await supabase.from('ss_host_profiles').upsert([{
            id: data.user.id,
            email,
            last_signup_email_sent_at: new Date().toISOString(),
        }], { onConflict: 'id' });

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('splitsubs/signup error:', err);
        return res.status(500).json({ error: err.message || 'Could not create your account — please try again.' });
    }
}
