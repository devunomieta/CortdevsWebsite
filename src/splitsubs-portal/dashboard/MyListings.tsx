import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { RefreshCw, Plus, Send, Pause, Play } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";
import { SeatChat } from "../components/SeatChat";
import { SEO } from "../components/SEO";

const money = (n: number) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

function CreateListingForm({ onCreated }: { onCreated: () => void }) {
    const { showToast } = useToast();
    const [services, setServices] = useState<any[]>([]);
    const [serviceId, setServiceId] = useState("");
    const [shortDescription, setShortDescription] = useState("");
    const [planCost, setPlanCost] = useState("");
    const [totalSeats, setTotalSeats] = useState("");
    const [proofUrl, setProofUrl] = useState("");
    const [subStartDate, setSubStartDate] = useState("");
    const [nextRenewalDate, setNextRenewalDate] = useState("");
    const [hostFieldsData, setHostFieldsData] = useState<Record<string, string>>({});
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState<"form" | "preview">("form");

    useEffect(() => { ssFetch("/api/splitsubs/services").then((d) => setServices(d.services || [])).catch(() => { }); }, []);
    const service = services.find((s) => s.id === serviceId);
    const proofRequired = service && ["medium", "high"].includes(service.risk_tier);

    const handleServiceChange = (id: string) => {
        setServiceId(id);
        const selected = services.find((s) => s.id === id);
        if (selected?.default_plan_cost) setPlanCost(String(selected.default_plan_cost));
    };

    const handleReview = (e: React.FormEvent) => {
        e.preventDefault();
        if (!consentAccepted) {
            showToast("Please confirm you understand the hosting terms before listing.", "error");
            return;
        }
        if (proofRequired && !proofUrl.trim()) {
            showToast("Proof of subscription is required for this service.", "error");
            return;
        }
        setStep("preview");
    };

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            const result = await ssFetch("/api/splitsubs/listings", {
                method: "POST",
                body: JSON.stringify({ serviceId, shortDescription, planCost: Number(planCost), totalSeats: Number(totalSeats), proofUrl, hostFieldsData, subStartDate, nextRenewalDate, consentAccepted }),
            });
            showToast(`Listing ${result.shortId} submitted for review.`, "success");
            onCreated();
        } catch (err: any) {
            showToast(err.message || "Could not create listing.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (step === "preview") {
        // Mirrors api/_lib/splitsubsFees.ts computeSeatPricing exactly — hosts
        // absorb none of the plan cost, only the (total seats - 1) seats
        // available to joiners divide it, so a fully-booked listing recoups
        // the host the ENTIRE plan cost, never a fraction of it.
        const seatsAvailable = totalSeats ? Math.max(Number(totalSeats) - 1, 0) : 0;
        const seatBase = seatsAvailable > 0 ? Number(planCost) / seatsAvailable : 0;
        const chargeRate = service?.default_charge_rate ?? 0;
        const serviceCharge = seatBase * chargeRate;
        const joinerPays = seatBase + serviceCharge;
        return (
            <div className="border border-border p-6 bg-card space-y-5">
                <div>
                    <h3 className="font-medium">Preview your listing</h3>
                    <p className="text-xs text-muted-foreground mt-1">This is how it'll look before it goes to review. Double-check the details.</p>
                </div>
                <div className="border border-border bg-background p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            {service?.icon_url && <img src={service.icon_url} alt="" className="w-10 h-10 object-contain shrink-0" />}
                            <div className="min-w-0">
                                <p className="font-medium truncate">{service?.name || "Untitled listing"}</p>
                                <p className="text-xs text-muted-foreground truncate">{service?.category}</p>
                            </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">SS-#### (assigned on submit)</span>
                    </div>
                    {shortDescription && <p className="text-sm text-muted-foreground">{shortDescription}</p>}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total seats</p>
                            <p>{totalSeats || "—"} seats · {money(Number(planCost) || 0)} plan</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Seats available</p>
                            <p>{seatsAvailable} seats · {money(joinerPays)} / seat</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sub started</p>
                            <p>{subStartDate || "—"}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Next renewal</p>
                            <p>{nextRenewalDate || "—"}</p>
                        </div>
                    </div>
                </div>

                {seatsAvailable > 0 && (
                    <div className="border border-border bg-secondary/20 p-4 space-y-2 text-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your 100% payback</p>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Each joiner pays</span>
                            <span className="font-medium">{money(joinerPays)}</span>
                        </div>
                        {/* Per-seat host/SplitSubs split — hidden per host-facing request, kept
                            here (not deleted) in case a future "view breakdown" toggle wants it. */}
                        {/* <div className="flex items-center justify-between pl-3">
                            <span className="text-muted-foreground">→ You (the host) get</span>
                            <span>{money(seatBase)}</span>
                        </div>
                        <div className="flex items-center justify-between pl-3">
                            <span className="text-muted-foreground">→ SplitSubs' fee</span>
                            <span>{money(serviceCharge)}</span>
                        </div> */}
                        <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
                            <span className="text-muted-foreground">You pay toward the plan yourself</span>
                            <span className="font-medium">₦0.00 — always</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Fill all {seatsAvailable} seat{seatsAvailable === 1 ? "" : "s"} and you get back</span>
                            <span className="font-medium">{money(seatBase * seatsAvailable)} — 100% of your plan cost</span>
                        </div>
                        <p className="text-xs text-muted-foreground pt-1">That's the whole point: your joiners cover the entire subscription between them. List more seats you're not using and keep more of what you already pay for.</p>
                    </div>
                )}
                <div className="flex gap-3">
                    <button type="button" onClick={() => setStep("form")} className="px-6 py-3 border border-border text-[10px] font-bold uppercase tracking-widest">Back to edit</button>
                    <button type="button" onClick={handleConfirm} disabled={isSubmitting} className="px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                        {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />} Confirm & Submit
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleReview} className="border border-border p-6 bg-card space-y-5">
            <div>
                <h3 className="font-medium">List your extra seats</h3>
                <p className="text-xs text-muted-foreground mt-1">Your joiners pay 100% of the plan cost between them — you pay nothing towards it. Fill every seat and you get your full subscription cost back.</p>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service</label>
                <select required value={serviceId} onChange={(e) => handleServiceChange(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm">
                    <option value="">Choose a service</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name} (up to {s.max_seats} seats)</option>)}
                </select>
                <p className="text-xs text-muted-foreground">Your listing's name, logo, and category come from the catalog — pick the plan you actually have.</p>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Short description (optional)</label>
                <textarea maxLength={280} rows={2} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="A quick line joiners see on the listing — e.g. plan tier, region, what's included." className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm resize-none" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plan cost (₦, whole plan)</label>
                    <input required type="number" min={1} value={planCost} onChange={(e) => setPlanCost(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                    {service?.default_plan_cost && <p className="text-xs text-muted-foreground">Pre-filled from the catalog — confirm it's right, or correct it if your actual price differs.</p>}
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total seats (incl. you)</label>
                    <input required type="number" min={2} max={service?.max_seats || 20} value={totalSeats} onChange={(e) => setTotalSeats(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your sub started on</label>
                    <input required type="date" value={subStartDate} onChange={(e) => setSubStartDate(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Next renewal date</label>
                    <input required type="date" value={nextRenewalDate} onChange={(e) => setNextRenewalDate(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3">Joiners see these dates so they know how fresh the plan is. If your renewal date passes without you confirming you've renewed, the listing auto-pauses.</p>
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Proof of subscription (link to screenshot/receipt){proofRequired && " *"}</label>
                <input required={proofRequired} value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                {proofRequired && <p className="text-xs text-muted-foreground">Required for this service — it's what review actually checks now that the plan details themselves are fixed.</p>}
            </div>
            {service && (service.host_fields || []).map((f: any) => (
                <div key={f.key} className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{f.label}{f.required && " *"}</label>
                    <input required={f.required} value={hostFieldsData[f.key] || ""} onChange={(e) => setHostFieldsData((prev) => ({ ...prev, [f.key]: e.target.value }))} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
            ))}
            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} className="mt-0.5 accent-primary" />
                <span>I confirm this subscription is real and active, and I agree to SplitSubs' hosting terms — including escrow and payout timing.</span>
            </label>
            <button type="submit" disabled={!consentAccepted} className="px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                <Send size={14} /> Review Listing
            </button>
        </form>
    );
}

export function MyListings() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [showCreate, setShowCreate] = useState(searchParams.get("create") === "1");
    const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
    const { showToast } = useToast();
    const list = usePaginatedList<any>("/api/splitsubs/host-listings", "listings");

    const grantAccess = async (seatId: string) => {
        try {
            await ssFetch("/api/splitsubs/access", { method: "POST", body: JSON.stringify({ action: "grant", seatId, accessNote: noteDrafts[seatId] || "" }) });
            showToast("Access marked as granted.", "success");
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not grant access.", "error");
        }
    };

    const toggleStatus = async (id: string, status: "paused" | "active") => {
        try {
            await ssFetch("/api/splitsubs/host-listings", { method: "PATCH", body: JSON.stringify({ id, status }) });
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not update listing.", "error");
        }
    };

    const reactivateExpired = async (id: string) => {
        const nextRenewalDate = window.prompt("This listing expired — confirm you've renewed and enter the new renewal date (YYYY-MM-DD):");
        if (!nextRenewalDate) return;
        try {
            await ssFetch("/api/splitsubs/host-listings", { method: "PATCH", body: JSON.stringify({ id, status: "active", nextRenewalDate }) });
            showToast("Listing reactivated.", "success");
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not reactivate listing.", "error");
        }
    };

    return (
        <div className="max-w-6xl space-y-6">
            <SEO title="My Listings" description="Subscriptions you're hosting seats on." path="/dashboard/listings" noindex />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-light tracking-tight mb-1">My Listings</h1>
                    <p className="text-sm text-muted-foreground">Subscriptions you're hosting — and getting paid for.</p>
                </div>
                <button onClick={() => { setShowCreate((v) => !v); setSearchParams({}); }} className="shrink-0 px-4 py-2.5 border border-border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-secondary">
                    <Plus size={14} /> {showCreate ? "Cancel" : "List a Seat"}
                </button>
            </div>

            {showCreate && <CreateListingForm onCreated={() => { setShowCreate(false); list.reload(); }} />}

            <div className="flex flex-wrap gap-2 items-center">
                <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search by title..." />
                <SortButton label="Newest" active={list.sort === "created_at"} order={list.order} onClick={() => { list.setSort("created_at"); list.setOrder(list.sort === "created_at" && list.order === "asc" ? "desc" : "asc"); }} />
                <SortButton label="Status" active={list.sort === "status"} order={list.order} onClick={() => { list.setSort("status"); list.setOrder(list.sort === "status" && list.order === "asc" ? "desc" : "asc"); }} />
            </div>

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border">
                    <p className="text-muted-foreground text-sm mb-4">No listings yet — your unused seats are just sitting there costing you money.</p>
                    <button onClick={() => setShowCreate(true)} className="inline-block px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all">List Your First Seat</button>
                </div>
            ) : (
                <div className="space-y-4">
                    {list.items.map((listing) => (
                        <div key={listing.id} className="border border-border p-6 bg-card">
                            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                                <div>
                                    <h3 className="font-medium">{listing.ss_services.name}</h3>
                                    <p className="text-xs text-muted-foreground">{listing.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{money(listing.pricing.totalPaid)} / seat · {listing.total_seats - 1} seats available</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-secondary">{listing.status.replace(/_/g, " ")}</span>
                                    {listing.status === "active" && (
                                        <button onClick={() => toggleStatus(listing.id, "paused")} className="p-2 border border-border hover:bg-secondary" title="Pause"><Pause size={14} /></button>
                                    )}
                                    {listing.status === "paused" && (
                                        <button onClick={() => toggleStatus(listing.id, "active")} className="p-2 border border-border hover:bg-secondary" title="Resume"><Play size={14} /></button>
                                    )}
                                    {listing.status === "expired" && (
                                        <button onClick={() => reactivateExpired(listing.id)} className="px-3 py-2 border border-border hover:bg-secondary text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"><Play size={14} /> Renewed? Reactivate</button>
                                    )}
                                </div>
                            </div>

                            {listing.seats.length > 0 && (
                                <div className="space-y-3 border-t border-border pt-4">
                                    {listing.seats.filter((s: any) => s.status !== "cancelled").map((seat: any) => (
                                        <div key={seat.id} className="bg-secondary/30 p-4 text-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{seat.status.replace(/_/g, " ")}</span>
                                            </div>
                                            {Object.keys(seat.joiner_fields_data || {}).length > 0 && (
                                                <div className="text-xs text-muted-foreground mb-2 space-y-0.5">
                                                    {Object.entries(seat.joiner_fields_data).map(([k, v]) => <div key={k}><strong>{k}:</strong> {String(v)}</div>)}
                                                </div>
                                            )}
                                            {seat.status === "escrow_held" && (
                                                <div className="space-y-2">
                                                    <p className="text-xs text-amber-600 font-medium">Someone already paid — grant their access now to get your money moving.</p>
                                                    <textarea
                                                        placeholder="Access details to send (invite confirmation, login, etc.)"
                                                        value={noteDrafts[seat.id] || ""}
                                                        onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [seat.id]: e.target.value }))}
                                                        rows={2}
                                                        className="w-full px-3 py-2 bg-background border border-border outline-none focus:border-primary text-xs resize-none"
                                                    />
                                                    <button onClick={() => grantAccess(seat.id)} className="px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest">Grant Access Now</button>
                                                </div>
                                            )}
                                            {["escrow_held", "access_pending", "confirmed", "disputed"].includes(seat.status) && (
                                                <div className="mt-3"><SeatChat seatId={seat.id} viewerRole="host" /></div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
        </div>
    );
}
