import { useEffect, useState } from "react";
import { Link } from "react-router";
import { RefreshCw, ArrowRight, Heart } from "lucide-react";
import { ssFetch } from "../lib/api";
import { SEO } from "../components/SEO";

export function DashboardOverview() {
    const [seats, setSeats] = useState<any[]>([]);
    const [listings, setListings] = useState<any[]>([]);
    const [wishlist, setWishlist] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        Promise.all([ssFetch("/api/splitsubs/my-seats"), ssFetch("/api/splitsubs/host-listings"), ssFetch("/api/splitsubs/wishlist")])
            .then(([s, l, w]) => { setSeats(s.seats || []); setListings(l.listings || []); setWishlist(w.items || []); })
            .catch(() => { })
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>;

    const activeSeats = seats.filter((s) => ["escrow_held", "access_pending", "confirmed"].includes(s.status));
    const needsAction = seats.filter((s) => s.status === "access_pending");
    const activeListings = listings.filter((l) => l.status === "active");
    const pendingReview = listings.filter((l) => l.status === "pending_review");

    return (
        <div className="space-y-10 max-w-7xl">
            <SEO title="Dashboard" description="Your SplitSubs seats and listings." path="/dashboard" noindex />
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
                    <p className="text-sm font-semibold mb-1">Oya, {needsAction.length} seat(s) dey wait for your confirmation</p>
                    <p className="text-xs text-muted-foreground mb-3">Don't sleep on this — confirming releases the host's payout, and it only takes a second.</p>
                    <Link to="/dashboard/seats" className="text-xs font-bold text-primary flex items-center gap-1">Confirm now <ArrowRight size={12} /></Link>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="border border-border p-6 bg-card">
                    <h3 className="font-medium mb-2">Still paying full price alone?</h3>
                    <p className="text-xs text-muted-foreground mb-4">Stop it. Grab an open seat on Netflix, Spotify, YouTube Premium and more — seats go fast, so don't delay.</p>
                    <Link to="/" className="text-xs font-bold text-primary flex items-center gap-1">Grab a seat now <ArrowRight size={12} /></Link>
                </div>
                <div className="border border-border p-6 bg-card">
                    <h3 className="font-medium mb-2">Already paying for a premium plan?</h3>
                    <p className="text-xs text-muted-foreground mb-4">Your joiners pay 100% of the cost between them — you pay nothing. Fill every seat and your full subscription cost comes back to you, escrow-protected from day one.</p>
                    <Link to="/dashboard/listings?create=1" className="text-xs font-bold text-primary flex items-center gap-1">List a seat, start earning <ArrowRight size={12} /></Link>
                </div>
            </div>

            {wishlist.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2"><Heart size={14} /> Your Wishlist</h2>
                    <div className="border border-border bg-card divide-y divide-border">
                        {wishlist.map((item) => (
                            <Link key={item.listing_id} to={`/listing/${item.listing_id}`} className="flex items-center justify-between px-5 py-4 hover:bg-secondary/50 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    {item.ss_listings?.ss_services?.icon_url && <img src={item.ss_listings.ss_services.icon_url} alt="" className="w-6 h-6 object-contain shrink-0" />}
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{item.ss_listings?.ss_services?.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{item.ss_listings?.title}</p>
                                    </div>
                                </div>
                                <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
