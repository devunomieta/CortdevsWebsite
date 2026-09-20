// The SplitSubs pricing formula (PRD "Pricing & Service Charge Model"):
//
//   SeatBase       = PlanCost / TotalSeats
//   JoinerPays     = SeatBase * (1 + r)
//   HostSettlement = (TotalSeats - 1) * SeatBase
//
// A host's own seat is never billed through the platform — they already pay
// the provider directly — so it's excluded from what they're owed at
// settlement. Only joiners' base contributions are paid out; the service
// charge is retained as platform revenue (minus the insurance-pool slice).
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
    return round2(planCost / totalSeats);
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
