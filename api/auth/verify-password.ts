import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password } = req.body;

    console.log('[API] Verify Password Request:', { email, hasPassword: !!password });
    console.log('[API] Supabase URL:', process.env.VITE_SUPABASE_URL ? 'PRESENT' : 'MISSING');
    console.log('[API] Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : (process.env.VITE_SUPABASE_ANON_KEY ? 'ANON_FALLBACK' : 'MISSING'));

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Attempt to sign in with password to verify it
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return res.status(401).json({ error: 'Verification failed' });
        }

        // We don't want to actually return the session/user details for a simple verification
        return res.status(200).json({ success: true, message: 'Password verified' });
    } catch (error: any) {
        console.error('Verification Error:', error);
        return res.status(500).json({ error: `Server error: ${error.message || 'Internal error'}` });
    }
}
