import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Identity email is required.' });
    }

    try {
        // 1. Call custom RPC for rate limiting
        // check_rate_limit(p_identifier, p_action, p_max_attempts, p_window_interval)
        const { data: isAllowed, error: rpcError } = await supabase.rpc('check_rate_limit', {
            p_identifier: email,
            p_action: 'password_reset',
            p_max_attempts: 3,
            p_window_interval: '1 hour'
        });

        if (rpcError) {
            console.error('RPC Error:', rpcError);
            // Fallback or handle error - if RPC fails, we might want to fail safe (deny) or allow (service availability)
            // Here we'll allow but log it
        }

        if (isAllowed === false) {
            return res.status(429).json({ error: 'Security threshold exceeded. Maximum 3 requests per hour permitted.' });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Auth Request Error:', error);
        return res.status(500).json({ error: 'Internal synchronization failure.' });
    }
}
