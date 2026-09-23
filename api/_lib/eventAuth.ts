import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';

// Event credentials (PRD §07) are NOT Supabase Auth users, so they can't use
// supabase.auth. This is a small, dependency-free stand-in for password hashing
// and signed, short-lived tokens — no bcrypt/jsonwebtoken package required.

const TOKEN_SECRET = process.env.EVENTS_TOKEN_SECRET || '';
if (!TOKEN_SECRET) {
    console.error('CRITICAL: EVENTS_TOKEN_SECRET is missing from environment variables.');
}
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours — long enough for a shift, short enough that a revoke takes effect same day

// Event credential passwords are stored reversibly (AES-256-GCM, keyed off
// EVENTS_TOKEN_SECRET) rather than one-way hashed. Deliberate tradeoff for
// this specific credential type: they're shared, low-entropy, admin-issued
// logins already mitigated by revocation/rate-limiting/RLS, not high-value
// per-user accounts — and it lets an admin view or resend the *current*
// password without rotating it, which one-way hashing can never support
// (that gap was the actual cause of "the password expires after every use":
// resending it had no choice but to silently issue a new one every time).
const ENC_KEY = crypto.createHash('sha256').update(TOKEN_SECRET || 'insecure-dev-key-do-not-use-in-prod').digest();

export function encryptSecret(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(stored: string): string | null {
    try {
        const [ivB64, tagB64, dataB64] = stored.split('.');
        const iv = Buffer.from(ivB64, 'base64url');
        const authTag = Buffer.from(tagB64, 'base64url');
        const data = Buffer.from(dataB64, 'base64url');
        const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
        // Covers both corruption and credentials stored under the old
        // one-way-hash scheme, pre-migration — either way, treat as invalid.
        return null;
    }
}

export function verifyStoredPassword(password: string, stored: string): boolean {
    const decrypted = decryptSecret(stored);
    if (decrypted === null) return false;
    const a = Buffer.from(decrypted);
    const b = Buffer.from(password);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

export type EventRole = 'organizer' | 'reception' | 'view_only' | 'full';

export interface EventTokenPayload {
    credentialId: string;
    eventId: string;
    slug: string;
    label: string;
    role: EventRole;
    exp: number; // unix seconds
}

function sign(data: string): string {
    return crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
}

export function signEventToken(payload: Omit<EventTokenPayload, 'exp'>): string {
    const full: EventTokenPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
    const body = Buffer.from(JSON.stringify(full)).toString('base64url');
    return `${body}.${sign(body)}`;
}

export function verifyEventToken(token: string): EventTokenPayload | null {
    const [body, signature] = token.split('.');
    if (!body || !signature) return null;
    const expected = sign(body);
    if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
        return null;
    }
    try {
        const payload: EventTokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString());
        if (payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
}

// Verifies the bearer token, and — if isActive is required — re-checks the
// credential is still active in the DB (a revoke takes effect on next request,
// not just at next login; the token TTL alone would let a revoked credential
// keep working for up to TOKEN_TTL_SECONDS).
export async function verifyEventAccess(
    req: VercelRequest,
    res: VercelResponse,
    opts: { requireRole?: 'organizer' | 'checkin_allowed' | 'full' } = {}
): Promise<EventTokenPayload | null> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Missing event session token' });
        return null;
    }

    const payload = verifyEventToken(token);
    if (!payload) {
        res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
        return null;
    }

    const { data: credential } = await supabase
        .from('event_credentials')
        .select('is_active')
        .eq('id', payload.credentialId)
        .maybeSingle();

    if (!credential || !credential.is_active) {
        res.status(401).json({ error: 'This login has been revoked.' });
        return null;
    }

    const { data: event } = await supabase
        .from('events')
        .select('status')
        .eq('id', payload.eventId)
        .maybeSingle();

    if (!event || event.status !== 'active') {
        res.status(403).json({ error: 'This event dashboard is currently disabled.' });
        return null;
    }

    if (opts.requireRole === 'organizer' && (payload.role !== 'organizer' && payload.role !== 'full')) {
        res.status(403).json({ error: 'Only event organizers can perform this action.' });
        return null;
    }

    if (opts.requireRole === 'checkin_allowed' && payload.role === 'view_only') {
        res.status(403).json({ error: 'View-only access cannot perform check-ins or walk-ins.' });
        return null;
    }

    if (opts.requireRole === 'full' && (payload.role !== 'full' && payload.role !== 'organizer')) {
        res.status(403).json({ error: 'View-only access cannot perform this action.' });
        return null;
    }

    return payload;
}

export function getClientIp(req: VercelRequest): string {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    return (ip || req.socket?.remoteAddress || 'unknown').trim();
}
