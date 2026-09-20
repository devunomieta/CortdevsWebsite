import { useEffect, useState } from "react";
import { Link } from "react-router";
import { RefreshCw, ArrowRight } from "lucide-react";
import { ssFetch } from "../lib/api";

export function DashboardOverview() {
    const [seats, setSeats] = useState<any[]>([]);
    const [listings, setListings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        Promise.all([ssFetch("/api/splitsubs/my-seats"), ssFetch("/api/splitsubs/host-listings")])
            .then(([s, l]) => { setSeats(s.seats || []); setListings(l.listings || []); })
            .catch(() => { })
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>;

    const activeSeats = seats.filter((s) => ["escrow_held", "access_pending", "confirmed"].includes(s.status));
    const needsAction = seats.filter((s) => s.status === "access_pending");
    const activeListings = listings.filter((l) => l.status === "active");
    const pendingReview = listings.filter((l) => l.status === "pending_review");

    return (
        <div className="space-y-10 max-w-5xl">
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Overview</h1>
                <p className="text-sm text-muted-foreground">Everything you're joined to and everything you're hosting, in one place.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Active seats", value: activeSeats.length },
                    { label: "Awaiting your confirm", value: needsAction.length },
                    { label: "Active listings", value: activeListings.length },
                    { label: "Pending review", value: pendingReview.length },
                ].map((stat) => (
                    <div key={stat.label} className="border border-border p-5 bg-card">
                        <p className="text-3xl font-light">{stat.value}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {needsAction.length > 0 && (
                <div className="border border-amber-500/30 bg-amber-500/5 p-5">
                    <p className="text-sm font-semibold mb-1">You have {needsAction.length} seat(s) waiting on your confirmation</p>
                    <p className="text-xs text-muted-foreground mb-3">Confirming access releases the host's payout — don't leave it hanging.</p>
                    <Link to="/dashboard/seats" className="text-xs font-bold text-primary flex items-center gap-1">Review now <ArrowRight size={12} /></Link>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="border border-border p-6 bg-card">
                    <h3 className="font-medium mb-2">Want to join a seat?</h3>
                    <p className="text-xs text-muted-foreground mb-4">Browse open seats across Netflix, Spotify, YouTube Premium, and more.</p>
                    <Link to="/" className="text-xs font-bold text-primary flex items-center gap-1">Browse open seats <ArrowRight size={12} /></Link>
                </div>
                <div className="border border-border p-6 bg-card">
                    <h3 className="font-medium mb-2">Already paying for a premium plan?</h3>
                    <p className="text-xs text-muted-foreground mb-4">List your open seats and get paid — escrow-protected from day one.</p>
                    <Link to="/dashboard/listings?create=1" className="text-xs font-bold text-primary flex items-center gap-1">List a seat <ArrowRight size={12} /></Link>
                </div>
            </div>
        </div>
    );
}
