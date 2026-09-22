import { supabase } from './supabase.js';

const FALLBACK_ADMIN_EMAIL = 'projects@cortdevs.com';
const ADMIN_ROLES = ['Superadmin', 'Admin', 'superadmin', 'admin'];

// Who should get admin-facing SplitSubs notifications — every user with an
// admin role in `profiles`, plus the fallback address verifyAdmin() (see
// api/_lib/auth.ts) always treats as an admin regardless of role, so a
// notification never silently goes nowhere if profiles is empty or
// misconfigured.
export async function getAdminEmails(): Promise<string[]> {
    const emails = new Set<string>([FALLBACK_ADMIN_EMAIL]);
    try {
        const { data: profiles } = await supabase.from('profiles').select('id').in('role', ADMIN_ROLES);
        await Promise.all((profiles || []).map(async (p) => {
            const { data } = await supabase.auth.admin.getUserById(p.id);
            if (data?.user?.email) emails.add(data.user.email);
        }));
    } catch (err) {
        console.error('getAdminEmails failed, falling back to default admin address:', err);
    }
    return Array.from(emails);
}
