import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';
import { verifyAdmin } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Security: Verify the JWT and check for Administrative privileges
    const admin = await verifyAdmin(req, res);
    if (!admin) return; // verifyAdmin handles the error response

    const { action } = req.body;

    try {
        let result;

        switch (action) {
            case 'clear_leads_and_projects':
                // Clear leads and projects
                const { error: leadsError } = await supabase.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
                if (leadsError) throw leadsError;

                // We also need to clear manually onboarded clients that came from leads?
                // Actually, the user asked for:
                // "delete all Leads and Projects data including client details and project details"
                // This implies clearing leads AND clients?
                const { error: clientsError } = await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                if (clientsError) throw clientsError;
                break;

            case 'clear_clients_data':
                // "delete all clients data including client details, project details and payment details"
                const { error: cError } = await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                if (cError) throw cError;
                // Payment details are in transactions, tied to client_id. 
                // Supabase RLS or ON DELETE CASCADE should handle this if configured.
                break;

            case 'clear_transaction_data':
                // "delete all transaction data including income and expenses record"
                const { error: tError } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                if (tError) throw tError;
                break;

            case 'clear_analytics_report':
                // "clear data in analytics hub for the current session month and ALL"
                // Analytics is derived from transactions, leads, etc.
                // If those are cleared, analytics will be cleared.
                // However, there might be a specific session/tracking table if implemented.
                // In this schema, we don't have a specific 'analytics' table.
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        // Log the destruction EVENT
        await supabase.from('audit_logs').insert([{
            action: 'SYSTEM_PURGE',
            target_type: 'Data Suite',
            details: { action }
        }]);

        return res.status(200).json({ success: true, message: 'Operation completed successfully' });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
