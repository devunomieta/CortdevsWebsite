// The SplitSubs pricing formula:
//
//   SeatBase       = PlanCost / (TotalSeats - 1)   [only joiner seats divide the cost]
//   JoinerPays     = SeatBase * (1 + r)
//   HostSettlement = (TotalSeats - 1) * SeatBase = PlanCost
//
// Business rule: hosts absorb none of the plan cost. TotalSeats always
// includes the host's own seat, but that seat is excluded from the division —
// a fully-booked listing recoups the host the ENTIRE plan cost, not
// PlanCost * (TotalSeats-1)/TotalSeats. The only thing ever taken from a host
// is the payout charge deducted at withdrawal time (see computePayoutSplit),
// not the plan cost itself. Joiners still pay the full service charge on top
// of their base share, same as before.
//
// Amounts round to the kobo (2dp) at the point a joiner-facing figure is
// produced, never mid-calculation, so a listing's displayed seat price always
// matches exactly what Paystack is asked to charge.

export interface SeatPricing {
    seatBase: number;
    serviceCharge: number;
    totalPaid: number;
}

export function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeSeatBase(planCost: number, totalSeats: number): number {
    return round2(planCost / (totalSeats - 1));
}

export function computeSeatPricing(planCost: number, totalSeats: number, chargeRate: number): SeatPricing {
    const seatBase = computeSeatBase(planCost, totalSeats);
    const serviceCharge = round2(seatBase * chargeRate);
    return { seatBase, serviceCharge, totalPaid: round2(seatBase + serviceCharge) };
}

// What the host is owed once every confirmed seat's payment is released from
// escrow — the sum of confirmed seats' seatBase, never the service charge.
export function computeHostSettlement(confirmedSeatBases: number[]): number {
    return round2(confirmedSeatBases.reduce((sum, base) => sum + base, 0));
}

// Escrow hold window by a service's risk tier (PRD "Escrow & settlement timing").
export function escrowHoldHours(
    riskTier: 'low' | 'medium' | 'high',
    settings: { escrow_hold_hours_low: number; escrow_hold_hours_medium: number; escrow_hold_hours_high: number }
): number {
    if (riskTier === 'low') return settings.escrow_hold_hours_low;
    if (riskTier === 'high') return settings.escrow_hold_hours_high;
    return settings.escrow_hold_hours_medium;
}

// The second anti-scam gate: even after escrow releases a seat's payment
// into the host's wallet, that credit stays locked until this much of the
// subscription's billing cycle has actually elapsed since the seat was
// confirmed — a host can't clear escrow fast then withdraw and vanish before
// the joiner's paid-for month is mostly over.
export function computeWalletEligibleAt(
    confirmedAt: Date,
    settings: { payout_min_cycle_pct: number; subscription_cycle_days: number }
): Date {
    const holdMs = settings.payout_min_cycle_pct * settings.subscription_cycle_days * 24 * 60 * 60 * 1000;
    return new Date(confirmedAt.getTime() + holdMs);
}

export interface PayoutSplit {
    fee: number;
    net: number;
}

// The payout charge — the only cost a host ever bears — taken out of a
// withdrawal, not out of the plan cost itself.
export function computePayoutSplit(amount: number, payoutChargeRate: number): PayoutSplit {
    const fee = round2(amount * payoutChargeRate);
    return { fee, net: round2(amount - fee) };
}
