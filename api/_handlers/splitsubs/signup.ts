import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { getSplitsubsAppUrl } from '../../_lib/appUrl.js';
import { sendSignupConfirmation } from '../../_lib/splitsubsEmail.js';
import { isValidEmail } from '../../_lib/validation.js';

const RESEND_COOLDOWN_MS = 45 * 1000;

// admin.listUsers has no email filter in the SDK, so this pages through
// looking for a match. Fine at this platform's current scale (a handful of
// users); if that ever changes, swap for a direct query once there's a
// reliable way to read auth.users (or track confirmation state ourselves).
// This is deliberately NOT ss_host_profiles — that table is only populated
// by this endpoint's own success path, so it can't see accounts created
// before this flow existed (or by any other path), which is exactly the bug
// this replaces: a real Supabase auth user existed with no matching
// ss_host_profiles row, so the old check found "nothing" and treated a
// legitimate unconfirmed retry as a brand-new signup — which Supabase then
// rejected as a duplicate.
async function findAuthUserByEmail(email: string) {
    const normalized = email.toLowerCase();
    for (let page = 1; page <= 5; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
        if (match) return match;
        if (data.users.length < 1000) return null;
    }
    return null;
}

// POST { email, password, whatsappNumber?, heardAboutUs?, consentAccepted } —
//        sign up (or, transparently, retry a signup that was never confirmed
//        — see below). consentAccepted must be true — Feature Audit doc,
//        Phase 1: no signup without ToS/Privacy acknowledgment, since this
//        platform handles payments, KYC documents, and bank details.
//        whatsappNumber/heardAboutUs are optional and collected unverified
//        (same doc: WhatsApp OTP is deliberately deferred, no free provider
//        exists at real scale — collecting the number now costs nothing).
// POST { action: 'resend', email, password } — re-send from the "check your
//        email" screen. `password` is carried in memory from the original
//        signup form (never re-typed, never in a URL) because generateLink's
//        'signup' branch requires it when it does end up creating a user.
//        consentAccepted isn't re-required here — it was already given on
//        the original submission that created the (still unconfirmed) account.
//
// Bypasses supabase.auth.signUp() entirely — that's what was sending the
// generic-sender, no-OTP, wrong-domain-link email — using the admin API to
// generate the link/OTP and sending our own branded email via Resend instead.
//
// A second signup attempt for an email that already has an unconfirmed
// account (someone who closed the tab, or is now clicking "resend") is NOT
// an error — generateLink's 'signup' type only works for genuinely new
// users, so that case is routed through 'magiclink' instead, which works for
// any existing user and, like the original signup token, confirms the email
// as a side effect of being verified. The frontend never needs to know which
// type was actually used — see VerifyOtp.tsx, which just tries both.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, password, action, whatsappNumber, heardAboutUs, consentAccepted } = req.body || {};
    if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });
    if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (action !== 'resend' && consentAccepted !== true) {
        return res.status(400).json({ error: 'Please accept the Terms and Privacy Policy to continue.' });
    }

    try {
        const { data: profile } = await supabase
            .from('ss_host_profiles')
            .select('last_signup_email_sent_at')
            .eq('email', email)
            .maybeSingle();

        if (profile?.last_signup_email_sent_at) {
            const elapsed = Date.now() - new Date(profile.last_signup_email_sent_at).getTime();
            if (elapsed < RESEND_COOLDOWN_MS) {
                return res.status(429).json({ error: `Please wait ${Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)}s before requesting another code.` });
            }
        }

        const existingUser = await findAuthUserByEmail(email);
        if (existingUser?.email_confirmed_at) {
            return res.status(409).json({ error: action === 'resend' ? 'This account is already confirmed — sign in instead.' : 'An account with this email already exists — sign in instead.' });
        }

        const redirectTo = `${getSplitsubsAppUrl()}/dashboard`;
        const { data, error } = existingUser
            ? await supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })
            : await supabase.auth.admin.generateLink({ type: 'signup', email, password, options: { redirectTo } });

        if (error) {
            const alreadyRegistered = /already registered|already exists|already been registered/i.test(error.message || '');
            if (alreadyRegistered) {
                return res.status(409).json({ error: 'An account with this email already exists — sign in instead.' });
            }
            throw error;
        }
        if (!data.properties?.action_link || !data.properties?.email_otp) {
            throw new Error('Could not generate a confirmation link.');
        }

        await sendSignupConfirmation(email, { confirmUrl: data.properties.action_link, otp: data.properties.email_otp });

        const profilePatch: Record<string, unknown> = {
            id: data.user.id,
            email,
            last_signup_email_sent_at: new Date().toISOString(),
        };
        if (action !== 'resend') {
            profilePatch.consent_accepted_at = new Date().toISOString();
            if (whatsappNumber) profilePatch.whatsapp_number = String(whatsappNumber).trim();
            if (heardAboutUs) profilePatch.heard_about_us = String(heardAboutUs).trim();
        }
        await supabase.from('ss_host_profiles').upsert([profilePatch], { onConflict: 'id' });

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('splitsubs/signup error:', err);
        return res.status(500).json({ error: err.message || 'Could not create your account — please try again.' });
    }
}
