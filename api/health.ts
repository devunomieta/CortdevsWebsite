import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        env_check: {
            has_resend: !!process.env.RESEND_API_KEY,
            has_supabase_url: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
            has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
    });
}
