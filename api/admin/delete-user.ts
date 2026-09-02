import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';
import { verifyAdmin } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const admin = await verifyAdmin(req, res);
    if (!admin) return;

    const { userId, email } = req.body;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    // Protect root identities
    const protectedEmails = ['projects@cortdevs.com', 'lionelunomieta@gmail.com'];
    if (email && protectedEmails.includes(email.toLowerCase())) {
        return res.status(403).json({ error: 'Root identity is protected from deletion.' });
    }

    try {
        // 1. Fetch target user profile to check role
        const { data: targetProfile } = await supabase
            .from('profiles')
            .select('role, email, full_name')
            .eq('id', userId)
            .maybeSingle();

        if (targetProfile?.role === 'Superadmin' && admin.email !== 'lionelunomieta@gmail.com' && admin.email !== 'projects@cortdevs.com') {
            return res.status(403).json({ error: 'Superadmin accounts can only be deleted by root Superadmin.' });
        }

        // 2. Delete wallet if exists
        await supabase.from('wallets').delete().eq('user_id', userId);

        // 3. Delete from public.profiles
        const { error: profileErr } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (profileErr) {
            throw new Error(`Failed to delete profile: ${profileErr.message}`);
        }

        // 4. Delete from auth.users (ignore error if not present in auth.users)
        try {
            await supabase.auth.admin.deleteUser(userId);
        } catch (authErr) {
            console.log(`Auth user deletion skipped for ${userId}:`, authErr);
        }

        // 5. Audit log
        await supabase.from('audit_logs').insert([{
            action: 'USER_DELETED',
            target_type: 'User',
            details: { email: email || targetProfile?.email, id: userId, deleted_by: admin.email }
        }]);

        return res.status(200).json({ success: true, message: 'User successfully purged from system.' });
    } catch (err: any) {
        console.error('Error deleting user:', err);
        return res.status(500).json({ error: err.message || 'Server error purging user.' });
    }
}
