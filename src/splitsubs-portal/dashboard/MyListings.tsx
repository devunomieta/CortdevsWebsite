import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { RefreshCw, Plus, Send, Pause, Play } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";

const money = (n: number) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

function CreateListingForm({ onCreated }: { onCreated: () => void }) {
    const { showToast } = useToast();
    const [services, setServices] = useState<any[]>([]);
    const [serviceId, setServiceId] = useState("");
    const [title, setTitle] = useState("");
    const [planCost, setPlanCost] = useState("");
    const [totalSeats, setTotalSeats] = useState("");
    const [proofUrl, setProofUrl] = useState("");
    const [hostFieldsData, setHostFieldsData] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => { ssFetch("/api/splitsubs/services").then((d) => setServices(d.services || [])).catch(() => { }); }, []);
    const service = services.find((s) => s.id === serviceId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await ssFetch("/api/splitsubs/listings", {
                method: "POST",
                body: JSON.stringify({ serviceId, title, planCost: Number(planCost), totalSeats: Number(totalSeats), proofUrl, hostFieldsData }),
            });
            showToast("Listing submitted for review.", "success");
            onCreated();
        } catch (err: any) {
            showToast(err.message || "Could not create listing.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="border border-border p-6 bg-card space-y-5">
            <h3 className="font-medium">List a seat</h3>
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service</label>
                <select required value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm">
                    <option value="">Choose a service</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name} (up to {s.max_seats} seats)</option>)}
                </select>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Listing title</label>
                <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Netflix Premium — 3 seats open" className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plan cost (₦, whole plan)</label>
                    <input required type="number" min={1} value={planCost} onChange={(e) => setPlanCost(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total seats (incl. you)</label>
                    <input required type="number" min={2} max={service?.max_seats || 20} value={totalSeats} onChange={(e) => setTotalSeats(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Proof of subscription (link to screenshot/receipt)</label>
                <input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
            </div>
            {service && (service.host_fields || []).map((f: any) => (
                <div key={f.key} className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{f.label}{f.required && " *"}</label>
                    <input required={f.required} value={hostFieldsData[f.key] || ""} onChange={(e) => setHostFieldsData((prev) => ({ ...prev, [f.key]: e.target.value }))} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
            ))}
            <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />} Submit for review
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

    return (
        <div className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-light tracking-tight mb-1">My Listings</h1>
                    <p className="text-sm text-muted-foreground">Subscriptions you're hosting seats on.</p>
                </div>
                <button onClick={() => { setShowCreate((v) => !v); setSearchParams({}); }} className="px-4 py-2.5 border border-border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-secondary">
                    <Plus size={14} /> {showCreate ? "Cancel" : "New Listing"}
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
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">No listings match.</p></div>
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
                                                    <textarea
                                                        placeholder="Access details to send (invite confirmation, login, etc.)"
                                                        value={noteDrafts[seat.id] || ""}
                                                        onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [seat.id]: e.target.value }))}
                                                        rows={2}
                                                        className="w-full px-3 py-2 bg-background border border-border outline-none focus:border-primary text-xs resize-none"
                                                    />
                                                    <button onClick={() => grantAccess(seat.id)} className="px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest">Grant Access</button>
                                                </div>
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
