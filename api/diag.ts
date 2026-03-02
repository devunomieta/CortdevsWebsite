import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const log: string[] = ["Starting diagnostics..."];

    try {
        log.push("Checking environment keys...");
        const env = {
            RESEND_KEY: !!process.env.RESEND_API_KEY,
            SUPABASE_URL: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
            SERVICE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            ANON_KEY: !!(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
        };
        log.push(`Env check: ${JSON.stringify(env)}`);

        log.push("Attempting to import Supabase lib...");
        const { supabase } = await import('./_lib/supabase.js');
        log.push(`Supabase lib imported. Instance exists: ${!!supabase}`);

        log.push("Attempting to import Resend lib...");
        const { resend } = await import('./_lib/resend.js');
        log.push(`Resend lib imported. Instance exists: ${!!resend}`);

        return res.status(200).json({
            success: true,
            log,
            environment: env
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack,
            log
        });
    }
}
