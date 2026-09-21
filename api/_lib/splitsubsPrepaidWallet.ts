import { supabase } from './supabase.js';

// A joiner's prepaid spending balance — separate from a host's earnings
// wallet (splitsubsWallet.ts). Computed from the ledger on every read, same
// reasoning as the host wallet: no cached balance to drift out of sync.
export async function getPrepaidBalance(userId: string): Promise<number> {
    const { data: rows, error } = await supabase
        .from('ss_prepaid_wallet_transactions')
        .select('type, amount, status')
        .eq('user_id', userId);
    if (error) throw error;

    let balance = 0;
    for (const row of rows || []) {
        if (row.type === 'topup' && row.status !== 'success') continue; // pending/failed top-ups don't count yet
        const amount = Number(row.amount);
        if (row.type === 'spend') balance -= amount;
        else balance += amount; // topup or refund
    }
    return Math.round((balance + Number.EPSILON) * 100) / 100;
}
