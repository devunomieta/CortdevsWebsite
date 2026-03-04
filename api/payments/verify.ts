import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { reference, projectId, gatewayId, amount } = req.body;

    if (!reference || !projectId || !gatewayId || !amount) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        // 1. Verify payment with Paystack (Optional: Add actual Paystack API call here if secret key is available)
        // For now, we trust the client-side success callback but we use service_role to bypass RLS

        // 2. Fetch Central Treasury Wallet
        const { data: wallet, error: walletError } = await supabase
            .from('wallets')
            .select('id')
            .eq('type', 'Central')
            .maybeSingle();

        if (walletError || !wallet) {
            throw new Error(`Central Treasury offline: ${walletError?.message || 'Not found'}`);
        }

        // 3. Record in wallet_transactions (Resilient to missing metadata column)
        const txData = {
            wallet_id: wallet.id,
            type: 'Credit',
            amount: parseFloat(amount),
            category: 'Project Payment',
            description: `Digital Settlement: via ${gatewayId} (Ref: ${reference})`,
            reference_id: projectId
        };

        const { error: txError } = await supabase.from('wallet_transactions').insert([
            { ...txData, metadata: { gateway: gatewayId, paystack_ref: reference } }
        ]);

        if (txError) {
            console.warn('[API] Primary insert failed, retrying without metadata column...', txError.message);
            // Fallback: Retry without metadata column if it doesn't exist yet
            const { error: retryError } = await supabase.from('wallet_transactions').insert([txData]);
            if (retryError) throw retryError;
        }

        // 4. Fetch current project data to get current paid_amount
        const { data: project, error: fetchError } = await supabase
            .from('clients')
            .select('paid_amount')
            .eq('id', projectId)
            .single();

        if (fetchError || !project) throw new Error("Could not retrieve project dossiers.");

        const currentPaid = parseFloat(project.paid_amount.replace(/[^0-9.]/g, '')) || 0;
        const newPaid = currentPaid + parseFloat(amount);

        // 5. Update client paid_amount
        const { error: clientError } = await supabase
            .from('clients')
            .update({ paid_amount: `$${newPaid.toLocaleString()}` })
            .eq('id', projectId);

        if (clientError) throw clientError;

        return res.status(200).json({
            success: true,
            message: 'Settlement synchronized successfully.'
        });
    } catch (error: any) {
        console.error('[API] Synchronization Error:', error);
        return res.status(500).json({
            error: `Server sync failed: ${error.message || 'Internal error'}`
        });
    }
}
