import { supabase } from './supabase.js';

export interface WalletSummary {
    balance: number;       // total ever credited minus total ever debited
    available: number;     // the slice of `balance` past its 80%-of-cycle hold and free of any open dispute
    locked: number;        // balance - available — still inside the hold window (or dispute-frozen)
}

// Computed fresh from the ledger on every read rather than maintaining a
// cached running balance — this platform's transaction volume doesn't need
// the optimization, and a computed balance can never drift out of sync with
// its own transactions.
export async function getWalletSummary(hostId: string): Promise<WalletSummary> {
    const { data: rows, error } = await supabase
        .from('ss_wallet_transactions')
        .select('type, amount, eligible_at, seat_id')
        .eq('host_id', hostId);
    if (error) throw error;

    let balance = 0;
    let available = 0;
    const now = Date.now();

    // A credit tied to a seat currently under an open dispute stays locked
    // regardless of eligible_at — the dispute resolution (admin/splitsubs/disputes.ts)
    // is what actually moves the money, not the clock.
    const seatIds = Array.from(new Set((rows || []).filter((r) => r.type === 'credit' && r.seat_id).map((r) => r.seat_id as string)));
    const disputedSeatIds = new Set<string>();
    if (seatIds.length) {
        const { data: disputes } = await supabase
            .from('ss_disputes')
            .select('seat_id')
            .in('seat_id', seatIds)
            .in('status', ['open', 'investigating']);
        (disputes || []).forEach((d) => disputedSeatIds.add(d.seat_id));
    }

    for (const row of rows || []) {
        const amount = Number(row.amount);
        if (row.type === 'credit') {
            balance += amount;
            const isEligible = row.eligible_at ? new Date(row.eligible_at).getTime() <= now : true;
            const isDisputed = row.seat_id ? disputedSeatIds.has(row.seat_id) : false;
            if (isEligible && !isDisputed) available += amount;
        } else {
            balance -= amount;
            available -= amount;
        }
    }

    balance = Math.round((balance + Number.EPSILON) * 100) / 100;
    available = Math.max(0, Math.round((available + Number.EPSILON) * 100) / 100);

    return { balance, available, locked: Math.round((balance - available + Number.EPSILON) * 100) / 100 };
}
