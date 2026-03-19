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

    // Check if user is an admin or superadmin
    // In this system, we can check the user metadata or a specific profiles table
    const isAdmin = user.user_metadata?.role === 'admin' || user.user_metadata?.role === 'superadmin' || user.email === 'projects@cortdevs.com';

    if (!isAdmin) {
        res.status(403).json({ error: 'Access denied. Administrative privileges required.' });
        return null;
    }

    return user;
}
