import { supabase } from './supabase.js';

// Lockout/backoff for /api/events/login (PRD §07, §12) — event credentials are
// shared, lower-entropy passwords by design, so this ships at launch rather
// than as a later hardening pass. Tracked per (email, ip) in login_attempts.

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS_IN_WINDOW = 5;

export async function checkLoginLockout(email: string, ip: string): Promise<{ locked: boolean; retryAfterSeconds?: number }> {
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    const { data: attempts } = await supabase
        .from('login_attempts')
        .select('attempted_at, succeeded')
        .eq('email', email.toLowerCase())
        .eq('ip', ip)
        .gte('attempted_at', windowStart)
        .order('attempted_at', { ascending: false });

    if (!attempts || attempts.length === 0) return { locked: false };

    const recentFailures = attempts.filter((a) => !a.succeeded);
    if (recentFailures.length >= MAX_ATTEMPTS_IN_WINDOW) {
        const oldestRelevant = new Date(recentFailures[recentFailures.length - 1].attempted_at);
        const retryAfterSeconds = Math.max(
            0,
            WINDOW_MINUTES * 60 - Math.floor((Date.now() - oldestRelevant.getTime()) / 1000)
        );
        return { locked: true, retryAfterSeconds };
    }

    return { locked: false };
}

export async function recordLoginAttempt(email: string, ip: string, eventId: string | null, succeeded: boolean) {
    await supabase.from('login_attempts').insert([
        { email: email.toLowerCase(), ip, event_id: eventId, succeeded },
    ]);
}
