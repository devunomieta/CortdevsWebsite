import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';

// Public endpoint for pre-login event presentation (title, flier, dates)
// Does NOT require authentication and exposes no private credentials or attendees.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const slug = String(req.query.slug || '').trim();
    if (!slug) {
        return res.status(400).json({ error: 'Slug is required.' });
    }

    try {
        const { data: event, error } = await supabase
            .from('events')
            .select('id, title, slug, status, flier_url, banner_url, start_date, end_date, description')
            .eq('slug', slug)
            .maybeSingle();

        if (error || !event || event.status === 'archived') {
            return res.status(404).json({ error: 'This event link is not active.' });
        }

        if (event.status === 'disabled') {
            return res.status(403).json({ error: 'This event dashboard has been disabled by a Cortdevs admin.' });
        }

        return res.status(200).json({
            id: event.id,
            title: event.title,
            slug: event.slug,
            flierUrl: event.flier_url || null,
            bannerUrl: event.banner_url || null,
            startDate: event.start_date || null,
            endDate: event.end_date || null,
            description: event.description || null,
        });
    } catch (err: any) {
        console.error('events/info error:', err);
        return res.status(500).json({ error: 'Could not load event information.' });
    }
}
