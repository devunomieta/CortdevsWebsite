import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { verifyAdmin } from '../../../_lib/auth.js';

// GET — the metrics from the PRD's "Goals & Success Metrics" table: GSV,
// take-rate revenue, seat fill rate, dispute rate, top services by volume.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const [{ data: seats }, { data: listings }, { data: disputes }, { data: settings }, { count: pendingDirectTransfers }, { data: prepaidRows }, { data: withdrawals }] = await Promise.all([
            supabase.from('ss_seats').select('status, seat_base, service_charge, total_paid, created_at, listing_id'),
            supabase.from('ss_listings').select('id, total_seats, status, service_id, ss_services(name)'),
            supabase.from('ss_disputes').select('id, status'),
            supabase.from('ss_platform_settings').select('insurance_pool_balance').eq('id', 1).single(),
            // Direct Transfer payments awaiting manual confirmation — the one
            // "transactions" number that's actually an admin action queue, not
            // just a health metric to glance at.
            supabase.from('ss_payments').select('id', { count: 'exact', head: true }).eq('provider', 'direct_transfer').eq('status', 'pending'),
            supabase.from('ss_prepaid_wallet_transactions').select('type, amount').eq('status', 'success'),
            supabase.from('ss_wallet_transactions').select('amount, fee_amount').eq('type', 'debit').eq('source', 'withdrawal').eq('withdrawal_status', 'paid'),
        ]);

        const paidStatuses = ['escrow_held', 'access_pending', 'confirmed', 'disputed'];
        const paidSeats = (seats || []).filter((s) => paidStatuses.includes(s.status) || s.status === 'refunded');

        const gsv = paidSeats.reduce((sum, s) => sum + Number(s.total_paid), 0);
        const takeRateRevenue = paidSeats.reduce((sum, s) => sum + Number(s.service_charge), 0);

        const activeListings = (listings || []).filter((l) => l.status === 'active');
        const takenByListing = new Map<string, number>();
        (seats || []).filter((s) => paidStatuses.includes(s.status)).forEach((s) => takenByListing.set(s.listing_id, (takenByListing.get(s.listing_id) || 0) + 1));
        const totalOpenSeats = activeListings.reduce((sum, l) => sum + (l.total_seats - 1), 0);
        const totalFilledSeats = activeListings.reduce((sum, l) => sum + (takenByListing.get(l.id) || 0), 0);
        const fillRate = totalOpenSeats > 0 ? Math.round((totalFilledSeats / totalOpenSeats) * 1000) / 10 : 0;

        const disputeRate = paidSeats.length > 0 ? Math.round(((disputes || []).length / paidSeats.length) * 1000) / 10 : 0;

        const volumeByService = new Map<string, number>();
        for (const listing of listings || []) {
            const taken = takenByListing.get(listing.id) || 0;
            const name = (listing as any).ss_services?.name || 'Unknown';
            volumeByService.set(name, (volumeByService.get(name) || 0) + taken);
        }
        const topServices = Array.from(volumeByService.entries()).map(([name, seatsJoined]) => ({ name, seatsJoined })).sort((a, b) => b.seatsJoined - a.seatsJoined).slice(0, 10);

        // Every joiner's current prepaid spending balance, summed — money the
        // platform is holding on their behalf (a liability, not revenue):
        // successful top-ups and refunds in, successful spends out (a topup
        // starts 'pending' until its webhook lands, so only 'success' rows
        // count — an abandoned/still-pending one isn't real balance yet).
        const prepaidWalletBalance = (prepaidRows || []).reduce((sum, r) => sum + (r.type === 'spend' ? -Number(r.amount) : Number(r.amount)), 0);

        // Net of the payout charge — the actual amount that left the platform
        // to host bank accounts, not the gross wallet debit.
        const totalPaidOut = (withdrawals || []).reduce((sum, w) => sum + (Number(w.amount) - Number(w.fee_amount)), 0);

        return res.status(200).json({
            gsv, takeRateRevenue, fillRate, disputeRate,
            activeListings: activeListings.length,
            openDisputes: (disputes || []).filter((d) => ['open', 'investigating'].includes(d.status)).length,
            insurancePoolBalance: settings?.insurance_pool_balance || 0,
            pendingDirectTransfers: pendingDirectTransfers || 0,
            prepaidWalletBalance,
            totalPaidOut,
            topServices,
        });
    } catch (err: any) {
        console.error('admin/splitsubs/analytics error:', err);
        return res.status(500).json({ error: 'Could not compute analytics.' });
    }
}
