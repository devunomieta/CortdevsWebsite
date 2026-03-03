import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ error: 'Token and new password are required for resynchronization.' });
    }

    try {
        // 1. Find user by reset_token
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('id, reset_expires')
            .eq('reset_token', token)
            .single();

        if (fetchError || !profile) {
            return res.status(404).json({ error: 'Invalid or expired synchronization key.' });
        }

        // 2. Check expiry
        if (new Date(profile.reset_expires) < new Date()) {
            return res.status(410).json({ error: 'Synchronization key has expired.' });
        }

        // 3. Update password via Auth Admin
        const { error: authError } = await supabase.auth.admin.updateUserById(
            profile.id,
            { password: password }
        );

        if (authError) throw authError;

        // 4. Clear reset token fields
        const { error: clearError } = await supabase
            .from('profiles')
            .update({
                reset_token: null,
                reset_expires: null
            })
            .eq('id', profile.id);

        if (clearError) {
            console.error('Failed to clear reset token:', clearError);
            // We don't throw here as the password IS changed, but it's a security hygiene issue
        }

        return res.status(200).json({
            success: true,
            message: 'Identity credentials resynchronized successfully.'
        });

    } catch (error: any) {
        console.error('Reset Password Error:', error);
        return res.status(500).json({
            error: 'Internal synchronization failure.',
            details: error.message
        });
    }
}
