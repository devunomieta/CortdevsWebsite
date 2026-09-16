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

export function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const candidate = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    if (candidate.length !== expected.length) return false;
    return crypto.timingSafeEqual(candidate, expected);
}

export interface EventTokenPayload {
    credentialId: string;
    eventId: string;
    slug: string;
    label: string;
    role: 'full' | 'view_only';
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
    opts: { requireRole?: 'full' } = {}
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

    if (opts.requireRole === 'full' && payload.role !== 'full') {
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
