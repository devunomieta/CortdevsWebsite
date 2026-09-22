import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { isValidEmail, isNonEmpty, withinLength, LIMITS } from '../../_lib/validation.js';

// POST { name?, email, requestedService?, requestedCountry? } — public, no
// auth required on purpose (Feature Audit doc, Phase 1): someone checking
// whether SplitSubs supports their service or country shouldn't need an
// account first just to say so. At least one of requestedService/
// requestedCountry is required; admin-reviewed, never auto-actioned.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { name, email, requestedService, requestedCountry } = req.body || {};
    if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });
    if (!isNonEmpty(requestedService) && !isNonEmpty(requestedCountry)) {
        return res.status(400).json({ error: 'Tell us the service and/or country you want supported.' });
    }
    if (name && !withinLength(name, LIMITS.name)) return res.status(400).json({ error: `Name must be ${LIMITS.name} characters or fewer.` });
    if (requestedService && !withinLength(requestedService, LIMITS.title)) return res.status(400).json({ error: `Service name must be ${LIMITS.title} characters or fewer.` });
    if (requestedCountry && !withinLength(requestedCountry, LIMITS.title)) return res.status(400).json({ error: `Country must be ${LIMITS.title} characters or fewer.` });

    try {
        await supabase.from('ss_service_requests').insert([{
            name: name ? String(name).trim() : null,
            email: String(email).trim(),
            requested_service: requestedService ? String(requestedService).trim() : null,
            requested_country: requestedCountry ? String(requestedCountry).trim() : null,
        }]);
        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('splitsubs/service-requests error:', err);
        return res.status(500).json({ error: 'Could not submit your request — please try again.' });
    }
}
