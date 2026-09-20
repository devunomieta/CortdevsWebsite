import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, Star, AlertTriangle } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";

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

export function MySeats() {
    const { showToast } = useToast();
    const [seats, setSeats] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = () => ssFetch("/api/splitsubs/my-seats").then((d) => setSeats(d.seats || [])).catch(() => { }).finally(() => setIsLoading(false));
    useEffect(() => { load(); }, []);

    const confirmAccess = async (seatId: string) => {
        setBusyId(seatId);
        try {
            await ssFetch("/api/splitsubs/access", { method: "POST", body: JSON.stringify({ action: "confirm", seatId }) });
            showToast("Access confirmed — the host's payout is released.", "success");
            load();
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
            load();
        } catch (err: any) {
            showToast(err.message || "Could not open dispute.", "error");
        } finally {
            setBusyId(null);
        }
    };

    const rate = async (seatId: string, ratingValue: number) => {
        try {
            await ssFetch("/api/splitsubs/ratings", { method: "POST", body: JSON.stringify({ seatId, rating: ratingValue }) });
            showToast("Thanks for rating.", "success");
        } catch (err: any) {
            showToast(err.message || "Could not save rating.", "error");
        }
    };

    if (isLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>;

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">My Seats</h1>
                <p className="text-sm text-muted-foreground">Every subscription you've joined.</p>
            </div>

            {seats.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border">
                    <p className="text-muted-foreground text-sm">You haven't joined any seats yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {seats.map((seat) => (
                        <div key={seat.id} className="border border-border p-6 bg-card">
                            <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                                <div>
                                    <h3 className="font-medium">{seat.ss_listings.ss_services.name}</h3>
                                    <p className="text-xs text-muted-foreground">{seat.ss_listings.title}</p>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-secondary">{STATUS_LABEL[seat.status] || seat.status}</span>
                            </div>

                            {seat.access_note && seat.status === "access_pending" && (
                                <div className="bg-secondary/50 border border-border p-4 mb-4 text-sm whitespace-pre-wrap">{seat.access_note}</div>
                            )}

                            <div className="flex flex-wrap gap-3 items-center">
                                {seat.status === "access_pending" && (
                                    <button onClick={() => confirmAccess(seat.id)} disabled={busyId === seat.id} className="px-4 py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                                        <ShieldCheck size={14} /> Confirm access works
                                    </button>
                                )}
                                {["escrow_held", "access_pending", "confirmed"].includes(seat.status) && (
                                    <button onClick={() => raiseDispute(seat.id)} disabled={busyId === seat.id} className="px-4 py-2.5 border border-border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-secondary disabled:opacity-50">
                                        <AlertTriangle size={14} /> Report a problem
                                    </button>
                                )}
                                {seat.status === "confirmed" && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-muted-foreground mr-1">Rate host:</span>
                                        {[1, 2, 3, 4, 5].map((n) => (
                                            <button key={n} onClick={() => rate(seat.id, n)} className="text-muted-foreground hover:text-amber-500 transition-colors">
                                                <Star size={16} />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
