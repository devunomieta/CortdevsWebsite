import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { RefreshCw, ShieldCheck, Star, ArrowRight, Wallet, Heart, Share2, Bell, CheckCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { ssPublicFetch, ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { SEO } from "../components/SEO";

interface JoinerField { key: string; label: string; type: string; required: boolean; help?: string }

const money = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

function NotifyMeForm({ listingId }: { listingId: string }) {
    const { showToast } = useToast();
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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

    if (sent) return <p className="text-sm text-primary font-medium flex items-center justify-center gap-1.5 py-4"><CheckCircle2 size={16} /> We'll email you when a seat opens up.</p>;

    return (
        <form onSubmit={handleSubmit} className="space-y-2">
            <input type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
            <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50">
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Bell className="w-4 h-4" /> Notify Me When a Seat Opens</>}
            </button>
        </form>
    );
}

export function ListingDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [listing, setListing] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
    const [fields, setFields] = useState<Record<string, string>>({});
    const [isJoining, setIsJoining] = useState(false);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [payWithWallet, setPayWithWallet] = useState(false);
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [isWishlisted, setIsWishlisted] = useState(false);

    useEffect(() => {
        ssPublicFetch(`/api/splitsubs/listings?id=${id}`).then((d) => setListing(d.listing)).catch(() => setListing(null)).finally(() => setIsLoading(false));
        supabase.auth.getSession().then(({ data: { session } }) => {
            setIsAuthed(!!session);
            if (session) {
                ssFetch("/api/splitsubs/prepaid-wallet").then((d) => setWalletBalance(d.balance)).catch(() => { });
                ssFetch("/api/splitsubs/wishlist").then((d) => setIsWishlisted((d.items || []).some((i: any) => i.listing_id === id))).catch(() => { });
            }
        });
    }, [id]);

    const toggleWishlist = async () => {
        if (!isAuthed) {
            navigate(`/dashboard/login?redirect=${encodeURIComponent(`/listing/${id}`)}`);
            return;
        }
        setIsWishlisted((v) => !v);
        try {
            await ssFetch("/api/splitsubs/wishlist", { method: isWishlisted ? "DELETE" : "POST", body: JSON.stringify({ listingId: id }) });
        } catch (err: any) {
            showToast(err.message || "Could not update your wishlist.", "error");
        }
    };

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try { await navigator.share({ title: listing?.ss_services?.name ? `${listing.ss_services.name} seat on SplitSubs` : "SplitSubs listing", url }); } catch { /* user cancelled — not an error */ }
        } else {
            await navigator.clipboard.writeText(url);
            showToast("Link copied to clipboard.", "success");
        }
    };

    const canPayWithWallet = walletBalance !== null && listing && walletBalance >= listing.pricing.totalPaid;

    const handleJoin = async () => {
        if (!isAuthed) {
            navigate(`/dashboard/login?redirect=${encodeURIComponent(`/listing/${id}`)}`);
            return;
        }
        const missing = (listing.ss_services.joiner_fields || []).filter((f: JoinerField) => f.required && !fields[f.key]?.trim());
        if (missing.length) {
            showToast(`Please fill in: ${missing.map((f: JoinerField) => f.label).join(", ")}`, "error");
            return;
        }
        if (!consentAccepted) {
            showToast("Please confirm you understand how escrow works before joining.", "error");
            return;
        }
        setIsJoining(true);
        try {
            const result = await ssFetch("/api/splitsubs/join", {
                method: "POST",
                body: JSON.stringify({ listingId: id, joinerFieldsData: fields, provider: payWithWallet && canPayWithWallet ? "wallet" : "paystack", consentAccepted }),
            });
            if (result.authorizationUrl) {
                window.location.href = result.authorizationUrl;
            } else if (result.success) {
                showToast("Seat secured — paid from your wallet balance.", "success");
                navigate("/dashboard/seats");
            }
        } catch (err: any) {
            showToast(err.message || "Could not start payment.", "error");
        } finally {
            setIsJoining(false);
        }
    };

    if (isLoading) return <div className="flex justify-center py-32"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>;
    if (!listing) return <div className="text-center py-32"><p className="text-muted-foreground">Listing not found.</p><Link to="/" className="text-primary text-sm font-semibold mt-4 inline-block">← Back to browse</Link></div>;

    return (
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-16">
            <SEO
                title={`${listing.ss_services.name} Seat Available — ${money(listing.pricing.totalPaid)}/mo`}
                description={`Join a ${listing.ss_services.name} seat for ${money(listing.pricing.totalPaid)}/month. Money held safe until your access is confirmed working — ${listing.openSeats} seat(s) left.`}
                path={`/listing/${id}`}
            />

            <div className="flex items-center justify-between mb-8">
                <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-block">← Back to browse</Link>
                <div className="flex items-center gap-2">
                    <button onClick={toggleWishlist} className="p-2 border border-border hover:bg-secondary" title="Save to wishlist">
                        <Heart size={16} className={isWishlisted ? "fill-rose-500 text-rose-500" : "text-muted-foreground"} />
                    </button>
                    <button onClick={handleShare} className="p-2 border border-border hover:bg-secondary" title="Share this listing">
                        <Share2 size={16} className="text-muted-foreground" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
                <div className="lg:col-span-3 space-y-8">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">{listing.ss_services.category}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{listing.short_id}</p>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                            {listing.ss_services.icon_url && <img src={listing.ss_services.icon_url} alt="" className="w-10 h-10 object-contain shrink-0" />}
                            <h1 className="text-3xl lg:text-4xl font-light tracking-tight">{listing.ss_services.name}</h1>
                        </div>
                        <p className="text-muted-foreground">{listing.title}</p>
                        {listing.short_description && <p className="text-sm text-muted-foreground mt-2">{listing.short_description}</p>}
                        {(listing.sub_start_date || listing.next_renewal_date) && (
                            <p className="text-xs text-muted-foreground mt-2">
                                {listing.sub_start_date && <>Active since {new Date(listing.sub_start_date).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })}</>}
                                {listing.sub_start_date && listing.next_renewal_date && " · "}
                                {listing.next_renewal_date && <>Renews {new Date(listing.next_renewal_date).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })}</>}
                            </p>
                        )}
                    </div>

                    <div className="border border-border p-6 bg-card">
                        <h3 className="text-sm font-semibold uppercase tracking-widest mb-4">Just fill this — no long story</h3>
                        <div className="space-y-4">
                            {(listing.ss_services.joiner_fields || []).map((f: JoinerField) => (
                                <div key={f.key} className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        {f.label}{f.required && " *"}
                                    </label>
                                    <input
                                        type={f.type === "email" ? "email" : "text"}
                                        value={fields[f.key] || ""}
                                        onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                        className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                    />
                                    {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                                </div>
                            ))}
                            {(listing.ss_services.joiner_fields || []).length === 0 && (
                                <p className="text-sm text-muted-foreground">Nothing else needed — pay now and your seat is locked in.</p>
                            )}
                        </div>
                    </div>

                    <div className="border border-border p-6 bg-secondary/30 flex gap-4">
                        <ShieldCheck className="w-6 h-6 text-primary shrink-0" />
                        <div>
                            <h3 className="text-sm font-semibold mb-1">Relax — your money is protected</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                We hold your payment, not the host. The host has to grant your access first —
                                then you confirm it's working before they see a kobo. Access never comes? You're
                                covered: open a dispute from your dashboard and we sort it out for you.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="border border-border p-6 bg-card lg:sticky lg:top-28 space-y-6">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Per seat, every month</p>
                            <p className="text-4xl font-light">{money(listing.pricing.totalPaid)}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                                {money(listing.pricing.seatBase)} base + {money(listing.pricing.serviceCharge)} service charge — no other charges, we promise
                            </p>
                            {listing.pctSaved > 0 && (
                                <span className="inline-block mt-3 px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest">
                                    You save {listing.pctSaved}% vs paying {money(listing.plan_cost)} alone
                                </span>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-sm border-t border-border pt-4">
                            <span className="text-muted-foreground">Total seats allowed</span>
                            <span className="font-semibold">{listing.total_seats} seats · {money(listing.plan_cost)} full plan</span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Seats available</span>
                            <span className={`font-semibold ${listing.openSeats <= 2 ? "text-rose-500" : ""}`}>
                                {listing.openSeats} of {listing.total_seats - 1}{listing.openSeats <= 2 && listing.openSeats > 0 ? " — almost gone!" : ""}
                            </span>
                        </div>

                        {listing.host.rating !== null && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Host rating</span>
                                <span className="font-semibold flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-current" /> {listing.host.rating} ({listing.host.completedSplits} splits)</span>
                            </div>
                        )}

                        {listing.openSeats < 1 ? (
                            <NotifyMeForm listingId={id!} />
                        ) : (
                            <>
                                {canPayWithWallet && (
                                    <label className="flex items-center gap-2 text-sm border border-border p-3 cursor-pointer hover:bg-secondary/50 transition-colors">
                                        <input type="checkbox" checked={payWithWallet} onChange={(e) => setPayWithWallet(e.target.checked)} className="accent-primary" />
                                        <Wallet size={14} className="text-primary" />
                                        <span>Pay from wallet balance ({money(walletBalance!)}) — instant, no checkout</span>
                                    </label>
                                )}

                                <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                                    <input type="checkbox" checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} className="mt-0.5 accent-primary" />
                                    <span>I understand my payment is held in escrow until I confirm access works, per SplitSubs' Terms.</span>
                                </label>

                                <button
                                    onClick={handleJoin}
                                    disabled={isJoining || !consentAccepted}
                                    className="w-full py-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                                >
                                    {isJoining ? <RefreshCw className="w-4 h-4 animate-spin" /> : payWithWallet && canPayWithWallet ? <>Pay & Secure Seat <ArrowRight className="w-4 h-4" /></> : <>Secure My Seat Now <ArrowRight className="w-4 h-4" /></>}
                                </button>
                                {!isAuthed && <p className="text-xs text-muted-foreground text-center">Quick sign-in first — takes less than a minute.</p>}
                                <p className="text-[10px] text-center text-muted-foreground">Backed by escrow. Your money moves only when your access works.</p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
