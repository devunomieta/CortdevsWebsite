import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { RefreshCw, ArrowRight, Heart, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { SEO } from "../components/SEO";

export function DashboardOverview() {
    const { showToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [seats, setSeats] = useState<any[]>([]);
    const [listings, setListings] = useState<any[]>([]);
    const [wishlist, setWishlist] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [paymentBanner, setPaymentBanner] = useState<"verifying" | "success" | "pending" | "failed" | null>(null);

    const loadDashboard = () => {
        Promise.all([ssFetch("/api/splitsubs/my-seats"), ssFetch("/api/splitsubs/host-listings"), ssFetch("/api/splitsubs/wishlist")])
            .then(([s, l, w]) => { setSeats(s.seats || []); setListings(l.listings || []); setWishlist(w.items || []); })
            .catch(() => { })
            .finally(() => setIsLoading(false));
    };

    useEffect(() => { loadDashboard(); }, []);

    // Paystack redirects here with ?paystack_ref= after checkout — the seat
    // stays "pending_payment" until something actually confirms the charge.
    // The webhook usually beats us to it, but it can't reach a local dev
    // server at all and can lag by a few seconds even in production, so this
    // is the fallback that makes "I paid, why does it still say pending?"
    // resolve itself instead of requiring a webhook to ever fire.
    useEffect(() => {
        const reference = searchParams.get("paystack_ref");
        if (!reference) return;
        setPaymentBanner("verifying");
        ssFetch(`/api/splitsubs/payments-verify?reference=${encodeURIComponent(reference)}`)
            .then((d) => {
                setPaymentBanner(d.status === "success" ? "success" : d.status === "failed" || d.status === "abandoned" ? "failed" : "pending");
                if (d.status === "success") loadDashboard();
            })
            .catch((err) => {
                setPaymentBanner("failed");
                showToast(err.message || "Could not verify your payment.", "error");
            })
            .finally(() => {
                searchParams.delete("paystack_ref");
                setSearchParams(searchParams, { replace: true });
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const removeFromWishlist = async (e: React.MouseEvent, listingId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const removedIndex = wishlist.findIndex((item) => item.listing_id === listingId);
        const removedItem = wishlist[removedIndex];
        setWishlist((prev) => prev.filter((item) => item.listing_id !== listingId));
        try {
            await ssFetch("/api/splitsubs/wishlist", { method: "DELETE", body: JSON.stringify({ listingId }) });
        } catch (err: any) {
            showToast(err.message || "Could not remove this listing.", "error");
            if (removedItem) setWishlist((prev) => [...prev.slice(0, removedIndex), removedItem, ...prev.slice(removedIndex)]);
        }
    };

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

            {paymentBanner === "verifying" && (
                <div className="border border-border bg-secondary/30 p-4 flex items-center gap-3">
                    <RefreshCw size={16} className="animate-spin text-muted-foreground shrink-0" />
                    <p className="text-sm">Confirming your payment with Paystack — this only takes a moment.</p>
                </div>
            )}
            {paymentBanner === "success" && (
                <div className="border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                    <p className="text-sm">Payment confirmed — your seat is secured and waiting on the host to grant access.</p>
                </div>
            )}
            {paymentBanner === "pending" && (
                <div className="border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
                    <RefreshCw size={16} className="text-amber-600 shrink-0" />
                    <p className="text-sm">Paystack hasn't confirmed this payment yet — refresh in a minute. If your bank already charged you, it'll clear shortly.</p>
                </div>
            )}
            {paymentBanner === "failed" && (
                <div className="border border-rose-500/30 bg-rose-500/5 p-4 flex items-center gap-3">
                    <AlertTriangle size={16} className="text-rose-500 shrink-0" />
                    <p className="text-sm">That payment didn't go through. No charge should have been made — open the listing again to retry.</p>
                </div>
            )}

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
                            <Link key={item.listing_id} to={`/listing/${item.listing_id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-secondary/50 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    {item.ss_listings?.ss_services?.icon_url && <img src={item.ss_listings.ss_services.icon_url} alt="" className="w-6 h-6 object-contain shrink-0" />}
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{item.ss_listings?.ss_services?.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{item.ss_listings?.short_description || (item.ss_listings?.status !== "active" ? "No longer available" : "")}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={(e) => removeFromWishlist(e, item.listing_id)} className="p-1.5 text-muted-foreground hover:text-rose-500" title="Remove from wishlist"><X size={14} /></button>
                                    <ArrowRight size={14} className="text-muted-foreground" />
                                </div>
                            </Link>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Saved from any listing's heart icon — tap it again there, or the × here, to remove.</p>
                </div>
            )}
        </div>
    );
}
