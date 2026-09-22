import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "framer-motion";
import { ShieldCheck, Users, Wallet, RefreshCw, Send, CheckCircle2, Star, Heart, Bell, Clock } from "lucide-react";
import { ssPublicFetch, ssFetch } from "../lib/api";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../app/components/Toast";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";
import { SEO } from "../components/SEO";

interface Listing {
    id: string;
    short_id: string;
    title: string;
    short_description: string | null;
    plan_cost: number;
    total_seats: number;
    openSeats: number;
    pctSaved: number;
    hostRating: number | null;
    next_renewal_date: string | null;
    pricing: { seatBase: number; serviceCharge: number; totalPaid: number };
    ss_services: { id: string; name: string; category: string; icon_url: string | null };
}

const money = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

function daysUntil(dateStr: string): number {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// Public, anonymous-friendly interest capture — no account needed to say
// "I want this service" or "support my country." Tracks real demand before
// anything gets built (Feature Audit doc, Phase 1).
function ServiceRequestForm() {
    const { showToast } = useToast();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [requestedService, setRequestedService] = useState("");
    const [requestedCountry, setRequestedCountry] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestedService.trim() && !requestedCountry.trim()) {
            showToast("Tell us the service and/or country you want supported.", "error");
            return;
        }
        setIsSubmitting(true);
        try {
            await ssPublicFetch("/api/splitsubs/service-requests", {
                method: "POST",
                body: JSON.stringify({ name: name.trim() || undefined, email, requestedService: requestedService.trim() || undefined, requestedCountry: requestedCountry.trim() || undefined }),
            });
            setSubmitted(true);
        } catch (err: any) {
            showToast(err.message || "Could not submit your request.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="border border-primary/30 bg-primary/5 p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-3" />
                <p className="font-medium">Got it — thanks for letting us know.</p>
                <p className="text-sm text-muted-foreground mt-1">We track every request like this to decide what to add next.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="border border-border bg-card p-6 lg:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
                <h3 className="font-medium mb-1">Don't see what you're looking for?</h3>
                <p className="text-xs text-muted-foreground">Tell us the service or country you want, no account needed — we use this to decide what to add next.</p>
            </div>
            <input type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className="px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
            <input placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
            <input placeholder="Service you want (e.g. Apple Music)" value={requestedService} onChange={(e) => setRequestedService(e.target.value)} className="px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
            <input placeholder="Country you want supported" value={requestedCountry} onChange={(e) => setRequestedCountry(e.target.value)} className="px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
            <button type="submit" disabled={isSubmitting} className="sm:col-span-2 px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />} Send Request
            </button>
        </form>
    );
}

// Inline "email me when a seat opens up" — replaces the usual card link for
// a sold-out listing, since there's nothing to join yet (Feature Audit doc,
// Phase 3).
function NotifyMeInline({ listingId }: { listingId: string }) {
    const { showToast } = useToast();
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsSubmitting(true);
        try {
            await ssPublicFetch("/api/splitsubs/notify-me", { method: "POST", body: JSON.stringify({ email, listingId }) });
            setSent(true);
        } catch (err: any) {
            showToast(err.message || "Could not save your request.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (sent) return <p className="text-xs text-primary font-medium flex items-center gap-1.5"><CheckCircle2 size={14} /> We'll email you when a seat opens up.</p>;

    return (
        <form onClick={(e) => e.preventDefault()} onSubmit={handleSubmit} className="flex gap-2">
            <input type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 min-w-0 px-3 py-2 bg-background border border-border outline-none focus:border-primary text-xs" />
            <button type="submit" disabled={isSubmitting} className="shrink-0 px-3 py-2 border border-border hover:bg-secondary text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 disabled:opacity-50">
                {isSubmitting ? <RefreshCw size={12} className="animate-spin" /> : <Bell size={12} />} Notify Me
            </button>
        </form>
    );
}

export function SplitSubsHome() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [serviceFilter, setServiceFilter] = useState<string>("");
    const [categoryFilter, setCategoryFilter] = useState<string>("");
    const [isAuthed, setIsAuthed] = useState(false);
    const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
    const [activeSubs, setActiveSubs] = useState<any[]>([]);
    const [stats, setStats] = useState<{ completedSplits: number; activeListings: number; services: { name: string; icon_url: string | null }[] } | null>(null);
    const list = usePaginatedList<Listing>("/api/splitsubs/listings", "listings", {
        extraParams: { ...(serviceFilter ? { service: serviceFilter } : {}), ...(categoryFilter ? { category: categoryFilter } : {}) },
    });

    useEffect(() => {
        ssPublicFetch("/api/splitsubs/stats").then(setStats).catch(() => { });
        supabase.auth.getSession().then(({ data: { session } }) => {
            setIsAuthed(!!session);
            if (session) {
                ssFetch("/api/splitsubs/wishlist").then((d) => setWishlistIds(new Set((d.items || []).map((i: any) => i.listing_id)))).catch(() => { });
                ssFetch("/api/splitsubs/my-seats?pageSize=6&sort=created_at&order=desc").then((d) => {
                    setActiveSubs((d.seats || []).filter((s: any) => s.status === "confirmed"));
                }).catch(() => { });
            }
        });
    }, []);

    // Both derived from the browse endpoint's own facet data — categories
    // and services that actually have an active listing right now, not the
    // full catalog (which includes services no one's currently hosting).
    const categories: string[] = list.raw?.categories || [];
    const availableServices: { id: string; name: string; category: string }[] = list.raw?.services || [];

    const toggleWishlist = async (e: React.MouseEvent, listingId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isAuthed) {
            navigate(`/dashboard/login?redirect=${encodeURIComponent("/")}`);
            return;
        }
        const isSaved = wishlistIds.has(listingId);
        setWishlistIds((prev) => {
            const next = new Set(prev);
            if (isSaved) next.delete(listingId); else next.add(listingId);
            return next;
        });
        try {
            await ssFetch("/api/splitsubs/wishlist", { method: isSaved ? "DELETE" : "POST", body: JSON.stringify({ listingId }) });
        } catch (err: any) {
            showToast(err.message || "Could not update your wishlist.", "error");
        }
    };

    return (
        <div>
            <SEO
                title="Stop Paying Full Price for Netflix, Spotify & More"
                description="Split Netflix, Spotify & more with real people — your money stays safe until access is confirmed. Join a seat or list yours today."
                path="/"
            />

            <section className="py-20 lg:py-28 bg-neutral-50 border-b border-border">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-3xl">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary mb-6">CortDevs · SplitSubs</p>
                        <h1 className="text-4xl lg:text-6xl font-light tracking-tight mb-6 leading-[1.1]">
                            Stop paying full price. Split it.
                        </h1>
                        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                            Grab a seat on Netflix, Spotify, YouTube Premium & more for less. Your money
                            stays safe with us until your access is confirmed working.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <a href="#listings" className="px-7 py-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-all">
                                Grab a Seat
                            </a>
                            <Link to="/dashboard/listings?create=1" className="px-7 py-4 border border-border text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-secondary transition-all">
                                List a Seat
                            </Link>
                        </div>
                    </motion.div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16">
                        {[
                            { icon: ShieldCheck, title: "Your money dey safe", body: "Held safe until you confirm your access is working." },
                            { icon: Users, title: "No fake hosts here", body: "Every host is bank-verified before their first payout." },
                            { icon: Wallet, title: "No hidden charges", body: "You see the exact price before you ever pay." },
                        ].map((item) => (
                            <div key={item.title} className="bg-card border border-border p-6">
                                <item.icon className="w-6 h-6 mb-3 text-primary" />
                                <h3 className="font-medium text-sm mb-1">{item.title}</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {isAuthed && activeSubs.length > 0 && (
                <section className="py-8 border-b border-border bg-card">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">You're currently on</p>
                        <div className="flex flex-wrap gap-3">
                            {activeSubs.map((seat) => (
                                <Link key={seat.id} to="/dashboard/seats" className="flex items-center gap-2 px-3 py-2 border border-border hover:border-primary transition-colors text-sm">
                                    {seat.ss_listings?.ss_services?.icon_url && <img src={seat.ss_listings.ss_services.icon_url} alt="" className="w-5 h-5 object-contain" />}
                                    {seat.ss_listings?.ss_services?.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <section id="listings" className="py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                        <div>
                            <h2 className="text-2xl font-light tracking-tight">Available seats — dey go fast</h2>
                            <p className="text-sm text-muted-foreground mt-1">Popular plans finish quick. See one you like? Don't sleep on it.</p>
                        </div>
                    </div>

                    {categories.length > 1 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            <button onClick={() => { setCategoryFilter(""); setServiceFilter(""); list.setPage(1); }} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border ${!categoryFilter ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                                All Categories
                            </button>
                            {categories.map((c) => (
                                <button key={c} onClick={() => { setCategoryFilter(c); setServiceFilter(""); list.setPage(1); }} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border ${categoryFilter === c ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                                    {c}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-6">
                        <button
                            onClick={() => { setServiceFilter(""); list.setPage(1); }}
                            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border ${!serviceFilter ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                        >
                            All
                        </button>
                        {availableServices.filter((s) => !categoryFilter || s.category === categoryFilter).map((s) => (
                            <button
                                key={s.id}
                                onClick={() => { setServiceFilter(s.id); list.setPage(1); }}
                                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border ${serviceFilter === s.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center mb-10">
                        <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search listings..." />
                        <SortButton label="Newest" active={list.sort === "created_at"} order={list.order} onClick={() => { list.setSort("created_at"); list.setOrder(list.sort === "created_at" && list.order === "asc" ? "desc" : "asc"); }} />
                        <SortButton label="Price" active={list.sort === "price"} order={list.order} onClick={() => { list.setSort("price"); list.setOrder(list.sort === "price" && list.order === "asc" ? "desc" : "asc"); }} />
                    </div>

                    {list.isLoading ? (
                        <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
                    ) : list.items.length === 0 ? (
                        <div className="text-center py-20 border border-dashed border-border">
                            <p className="text-muted-foreground text-sm mb-4">No seats dey available right now — but new ones drop daily. Check back soon.</p>
                            <Link to="/dashboard/listings?create=1" className="inline-block px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all">
                                Be the First to List One
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {list.items.map((listing) => {
                                const soldOut = listing.openSeats <= 0;
                                const renewsIn = listing.next_renewal_date ? daysUntil(listing.next_renewal_date) : null;
                                return (
                                    <Link
                                        key={listing.id}
                                        to={`/listing/${listing.id}`}
                                        className={`relative block border border-border p-6 transition-colors bg-card group ${soldOut ? "opacity-70" : "hover:border-primary"}`}
                                    >
                                        <button onClick={(e) => toggleWishlist(e, listing.id)} className="absolute top-4 right-4 text-muted-foreground hover:text-rose-500 transition-colors z-10" title="Save to wishlist">
                                            <Heart size={16} className={wishlistIds.has(listing.id) ? "fill-rose-500 text-rose-500" : ""} />
                                        </button>
                                        <div className="flex items-center justify-between mb-4 pr-6">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{listing.ss_services.category}</span>
                                            {soldOut ? (
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-0.5">Sold Out</span>
                                            ) : (
                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${listing.openSeats <= 2 ? "text-rose-500" : "text-primary"}`}>
                                                    {listing.openSeats <= 2 ? `Only ${listing.openSeats} left!` : `${listing.openSeats} seats open`}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mb-1">
                                            {listing.ss_services.icon_url && (
                                                <img src={listing.ss_services.icon_url} alt="" className="w-8 h-8 object-contain shrink-0" />
                                            )}
                                            <h3 className="font-medium text-lg group-hover:text-primary transition-colors">{listing.ss_services.name}</h3>
                                        </div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-xs text-muted-foreground truncate">{listing.title}</p>
                                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">{listing.short_id}</span>
                                        </div>
                                        {listing.short_description && <p className="text-xs text-muted-foreground truncate mb-2">{listing.short_description}</p>}
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {listing.pctSaved > 0 && (
                                                <span className="inline-block px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest">
                                                    Save {listing.pctSaved}%
                                                </span>
                                            )}
                                            {renewsIn !== null && renewsIn > 0 && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                                                    <Clock size={10} /> Renews in {renewsIn}d
                                                </span>
                                            )}
                                        </div>
                                        {soldOut ? (
                                            <NotifyMeInline listingId={listing.id} />
                                        ) : (
                                            <div className="flex items-end justify-between">
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Per seat, every month</p>
                                                    <p className="text-2xl font-light">{money(listing.pricing.totalPaid)}</p>
                                                </div>
                                                <div className="text-right">
                                                    {listing.hostRating !== null && (
                                                        <p className="text-xs font-semibold flex items-center justify-end gap-1 mb-0.5"><Star size={11} className="fill-current text-amber-500" /> {listing.hostRating}</p>
                                                    )}
                                                    <p className="text-[10px] text-muted-foreground">of {listing.total_seats} seats total</p>
                                                </div>
                                            </div>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                    <div className="mt-10">
                        <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
                    </div>
                </div>
            </section>

            {stats && stats.services.length > 0 && (
                <section className="py-16 lg:py-20 border-t border-border">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8">
                        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                            <h2 className="text-xl font-light tracking-tight">Services we support</h2>
                            <p className="text-sm text-muted-foreground">{stats.completedSplits}+ splits completed · {stats.activeListings} active listings right now</p>
                        </div>
                        <div className="flex flex-wrap gap-6">
                            {stats.services.map((s) => (
                                <div key={s.name} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    {s.icon_url && <img src={s.icon_url} alt="" className="w-6 h-6 object-contain" />}
                                    {s.name}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <section className="py-16 lg:py-20 bg-neutral-50 border-t border-border">
                <div className="max-w-3xl mx-auto px-6 lg:px-8">
                    <ServiceRequestForm />
                </div>
            </section>
        </div>
    );
}
