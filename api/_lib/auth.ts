import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';

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

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return null;
    }

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
