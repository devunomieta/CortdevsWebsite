import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';

// Short-lived (30s) verified-JWT cache on warm serverless instances.
// Cuts redundant Supabase Auth HTTP round-trips under burst traffic while
// `requireLmsMember` still enforces live enrollment status checks in Postgres.
const AUTH_CACHE_TTL_MS = 30_000;
const AUTH_CACHE_MAX_ENTRIES = 200;
const verifiedUserCache = new Map<string, { user: any; expiresAt: number }>();

function getJwtExpiryMs(token: string): number {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return 0;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        return typeof payload?.exp === 'number' ? payload.exp * 1000 : 0;
    } catch {
        return 0;
    }
}

export async function verifyAuth(req: VercelRequest, res: VercelResponse) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: 'Authorization header missing' });
        return null;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Token missing' });
        return null;
    }

    const now = Date.now();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const cached = verifiedUserCache.get(tokenHash);
    if (cached && cached.expiresAt > now) {
        return cached.user;
    }

    let user: any = null;
    let lastError: any = null;

    // Retry once on transient network/connect timeouts so brief Supabase Auth hiccups
    // never falsely log active learners out with a 401.
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const { data, error } = await supabase.auth.getUser(token);
            if (!error && data?.user) {
                user = data.user;
                lastError = null;
                break;
            }
            lastError = error;
            const msg = String(error?.message || '').toLowerCase();
            const isTransient = msg.includes('fetch failed') || msg.includes('timeout') || msg.includes('econnreset');
            if (!isTransient) break;
        } catch (err: any) {
            lastError = err;
        }
        await new Promise((r) => setTimeout(r, 250));
    }

    if (lastError || !user) {
        const msg = String(lastError?.message || '').toLowerCase();
        const isTransient = msg.includes('fetch failed') || msg.includes('timeout') || msg.includes('econnreset');
        if (isTransient) {
            res.status(503).json({ error: 'Authentication service temporarily busy. Please retry.' });
            return null;
        }
        res.status(401).json({ error: 'Invalid or expired token' });
        return null;
    }

    const jwtExpMs = getJwtExpiryMs(token);
    const cacheUntil = Math.min(now + AUTH_CACHE_TTL_MS, jwtExpMs > now ? jwtExpMs : now + AUTH_CACHE_TTL_MS);
    if (verifiedUserCache.size >= AUTH_CACHE_MAX_ENTRIES) {
        const firstKey = verifiedUserCache.keys().next().value;
        if (firstKey) verifiedUserCache.delete(firstKey);
    }
    verifiedUserCache.set(tokenHash, { user, expiresAt: cacheUntil });

    return user;
}

export async function verifyAdmin(req: VercelRequest, res: VercelResponse) {
    const user = await verifyAuth(req, res);
    if (!user) return null;

    // Check role in profiles table or metadata
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const role = profile?.role || user.user_metadata?.role;
    const isAdmin = ['Superadmin', 'Admin', 'superadmin', 'admin'].includes(role) || user.email === 'projects@cortdevs.com';

    if (!isAdmin) {
        res.status(403).json({ error: 'Access denied. Administrative privileges required.' });
        return null;
    }

    return user;
}
