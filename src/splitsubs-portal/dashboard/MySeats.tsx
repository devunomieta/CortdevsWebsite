import { useState } from "react";
import { RefreshCw, ShieldCheck, Star, AlertTriangle, Clock } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SortButton, Pagination } from "../components/ListControls";
import { SeatChat } from "../components/SeatChat";
import { SEO } from "../components/SEO";

const STATUS_LABEL: Record<string, string> = {
    pending_payment: "Payment pending",
    escrow_held: "Waiting on host to grant access",
    access_pending: "Access granted — confirm it works",
    confirmed: "Confirmed",
    disputed: "Under dispute",
    refunded: "Refunded",
    cancelled: "Cancelled",
    churned: "Ended",
};

const money = (n: number) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" }) : "—";

function daysUntil(dateStr: string): number {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function expiryLabel(nextRenewalDate: string | null): string | null {
    if (!nextRenewalDate) return null;
    const days = daysUntil(nextRenewalDate);
    if (days > 1) return `Expires in ${days} days`;
    if (days === 1) return "Expires tomorrow";
    if (days === 0) return "Expires today";
    return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
}

export function MySeats() {
    const { showToast } = useToast();
    const [busyId, setBusyId] = useState<string | null>(null);
    const list = usePaginatedList<any>("/api/splitsubs/my-seats", "seats");

    const confirmAccess = async (seatId: string) => {
        setBusyId(seatId);
        try {
            await ssFetch("/api/splitsubs/access", { method: "POST", body: JSON.stringify({ action: "confirm", seatId }) });
            showToast("Access confirmed — the host's payout is released.", "success");
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not confirm access.", "error");
        } finally {
            setBusyId(null);
        }
    };

    const raiseDispute = async (seatId: string) => {
        const reason = window.prompt("What's wrong? (e.g. access never arrived, credentials don't work)");
        if (!reason) return;
        setBusyId(seatId);
        try {
            await ssFetch("/api/splitsubs/disputes", { method: "POST", body: JSON.stringify({ seatId, reason }) });
            showToast("Dispute opened — an admin will review it.", "success");
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not open dispute.", "error");
        } finally {
            setBusyId(null);
        }
    };

    const rate = async (seatId: string, ratingValue: number) => {
        setBusyId(seatId);
        try {
            await ssFetch("/api/splitsubs/ratings", { method: "POST", body: JSON.stringify({ seatId, rating: ratingValue }) });
            showToast("Thanks for rating.", "success");
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not save rating.", "error");
            if (err.message?.includes("already rated")) list.reload(); // UI was stale — resync so the stars lock in
        } finally {
            setBusyId(null);
        }
    };

    const checkPayment = async (seatId: string) => {
        setBusyId(seatId);
        try {
            const result = await ssFetch(`/api/splitsubs/payments-verify?seatId=${seatId}`);
            if (result.status === "success") showToast("Payment confirmed — your seat is now secured.", "success");
            else if (result.status === "failed" || result.status === "abandoned") showToast("That payment didn't go through. Open the listing again to retry.", "error");
            else showToast("Paystack hasn't confirmed this one yet — try again shortly.", "error");
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not check payment status.", "error");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="max-w-6xl space-y-6">
            <SEO title="My Seats" description="Every subscription seat you've joined." path="/dashboard/seats" noindex />
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-light tracking-tight mb-1">My Seats</h1>
                    <p className="text-sm text-muted-foreground">Every subscription you've joined.</p>
                </div>
                <SortButton label="Newest" active={list.sort === "created_at"} order={list.order} onClick={() => { list.setSort("created_at"); list.setOrder(list.sort === "created_at" && list.order === "asc" ? "desc" : "asc"); }} />
            </div>

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border">
                    <p className="text-muted-foreground text-sm mb-4">You haven't joined any seats yet — you're still paying full price somewhere.</p>
                    <a href="/" className="inline-block px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all">Browse Seats & Start Saving</a>
                </div>
            ) : (
                <div className="space-y-4">
                    {list.items.map((seat) => {
                        const listing = seat.ss_listings;
                        const expiry = expiryLabel(listing?.next_renewal_date);
                        const isExpired = listing?.next_renewal_date && daysUntil(listing.next_renewal_date) < 0;
                        return (
                            <div key={seat.id} className="border border-border p-6 bg-card">
                                <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {listing?.ss_services?.icon_url && <img src={listing.ss_services.icon_url} alt="" className="w-9 h-9 object-contain shrink-0" />}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-medium truncate">{listing?.ss_services?.name}</h3>
                                                {listing?.short_id && <span className="text-[10px] text-muted-foreground font-mono shrink-0">{listing.short_id}</span>}
                                            </div>
                                            {listing?.short_description && <p className="text-xs text-muted-foreground truncate">{listing.short_description}</p>}
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-secondary shrink-0">{STATUS_LABEL[seat.status] || seat.status}</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4 pb-4 border-b border-border">
                                    <div>
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">You pay</p>
                                        <p className="font-medium">{money(seat.total_paid)}/mo</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Sub started</p>
                                        <p className="font-medium">{fmtDate(listing?.sub_start_date)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Renews / expires</p>
                                        <p className="font-medium">{fmtDate(listing?.next_renewal_date)}</p>
                                    </div>
                                    {expiry && (
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Countdown</p>
                                            <p className={`font-medium flex items-center gap-1 ${isExpired ? "text-destructive" : ""}`}><Clock size={11} /> {expiry}</p>
                                        </div>
                                    )}
                                </div>

                                {seat.access_note && seat.status === "access_pending" && (
                                    <div className="bg-secondary/50 border border-border p-4 mb-4 text-sm whitespace-pre-wrap">{seat.access_note}</div>
                                )}

                                <div className="flex flex-wrap gap-3 items-center">
                                    {seat.status === "pending_payment" && (
                                        <button onClick={() => checkPayment(seat.id)} disabled={busyId === seat.id} className="px-4 py-2.5 border border-border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-secondary disabled:opacity-50">
                                            {busyId === seat.id ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />} Check Payment Status
                                        </button>
                                    )}
                                    {seat.status === "access_pending" && (
                                        <button onClick={() => confirmAccess(seat.id)} disabled={busyId === seat.id} className="px-4 py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                                            <ShieldCheck size={14} /> Confirm It's Working
                                        </button>
                                    )}
                                    {["escrow_held", "access_pending", "confirmed"].includes(seat.status) && (
                                        <button onClick={() => raiseDispute(seat.id)} disabled={busyId === seat.id} className="px-4 py-2.5 border border-border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-secondary disabled:opacity-50">
                                            <AlertTriangle size={14} /> Report a problem
                                        </button>
                                    )}
                                    {seat.status === "confirmed" && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-muted-foreground mr-1">{seat.myRating ? "You rated:" : "Rate host:"}</span>
                                            {[1, 2, 3, 4, 5].map((n) => (
                                                seat.myRating ? (
                                                    <Star key={n} size={16} className={n <= seat.myRating ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"} />
                                                ) : (
                                                    <button key={n} onClick={() => rate(seat.id, n)} disabled={busyId === seat.id} className="text-muted-foreground hover:text-amber-500 transition-colors disabled:opacity-50">
                                                        <Star size={16} />
                                                    </button>
                                                )
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {["escrow_held", "access_pending", "confirmed", "disputed"].includes(seat.status) && (
                                    <div className="mt-4"><SeatChat seatId={seat.id} viewerRole="joiner" /></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
        </div>
    );
}
