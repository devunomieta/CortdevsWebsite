import { useEffect, useState } from "react";
import { RefreshCw, Check, X, Pause, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";
import { AdminSeatChatViewer } from "./AdminSeatChatViewer";
import { SEO } from "../components/SEO";

const TABS = ["pending_review", "active", "paused", "expired", "suspended", "rejected"];
const money = (n: number) => `₦${Number(n).toLocaleString("en-NG")}`;
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" }) : "—";

// The plan summary a reviewer actually needs before deciding: what the host
// says they're subscribed to, since when, what they attached as proof, and
// whatever extra info the service's own host_fields schema asked for.
function ListingSummary({ l }: { l: any }) {
    const hostFieldSchema: any[] = l.ss_services?.host_fields || [];
    const hostFieldEntries = Object.entries(l.host_fields_data || {});

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-border text-xs">
            <div className="space-y-2">
                {l.short_description && <p className="text-muted-foreground">{l.short_description}</p>}
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Host</span><span>{l.hostEmail || "unknown"}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Sub started</span><span>{fmtDate(l.sub_start_date)}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Next renewal</span><span>{fmtDate(l.next_renewal_date)}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Risk tier</span><span className="capitalize">{l.ss_services?.risk_tier || "—"}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Access type</span><span>{l.ss_services?.access_type === "invite" ? "Invite link" : "Shared login"}</span></div>
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Proof of subscription</span>
                    {l.proof_url ? (
                        <a href={l.proof_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">View <ExternalLink size={10} /></a>
                    ) : (
                        <span className="text-rose-500">Not provided</span>
                    )}
                </div>
                {l.rejection_reason && (
                    <div className="pt-1">
                        <span className="text-muted-foreground">Last reason on file:</span>
                        <p className="mt-0.5">{l.rejection_reason}</p>
                    </div>
                )}
            </div>
            <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Host-submitted details</p>
                {hostFieldEntries.length === 0 ? (
                    <p className="text-muted-foreground">Nothing else was required for this service.</p>
                ) : (
                    hostFieldEntries.map(([key, value]) => {
                        const schemaField = hostFieldSchema.find((f) => f.key === key);
                        return (
                            <div key={key} className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground shrink-0">{schemaField?.label || key}</span>
                                <span className="text-right break-all">{String(value)}</span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function ListingSeats({ listingId }: { listingId: string }) {
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [seats, setSeats] = useState<any[]>([]);

    useEffect(() => {
        ssFetch(`/api/admin/splitsubs/listings?id=${listingId}`)
            .then((d) => setSeats(d.seats || []))
            .catch((err) => showToast(err.message || "Could not load seats.", "error"))
            .finally(() => setIsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listingId]);

    if (isLoading) return <div className="flex justify-center py-6"><RefreshCw className="animate-spin text-muted-foreground" size={16} /></div>;
    if (seats.length === 0) return <p className="text-xs text-muted-foreground py-3">No seats on this listing yet.</p>;

    return (
        <div className="space-y-2 py-3">
            {seats.map((s) => (
                <div key={s.id} className="border border-border p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{s.status.replace(/_/g, " ")}</p>
                    <AdminSeatChatViewer seatId={s.id} />
                </div>
            ))}
        </div>
    );
}

export function AdminListings() {
    const { showToast } = useToast();
    const [status, setStatus] = useState("pending_review");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const list = usePaginatedList<any>("/api/admin/splitsubs/listings", "listings", { extraParams: { status } });

    const act = async (id: string, action: "approve" | "reject" | "suspend") => {
        let rejectionReason: string | undefined;
        if (action === "reject" || action === "suspend") {
            rejectionReason = window.prompt("Reason (shown to the host)?") || undefined;
        }
        try {
            await ssFetch("/api/admin/splitsubs/listings", { method: "PATCH", body: JSON.stringify({ id, action, rejectionReason }) });
            showToast("Updated.", "success");
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not update listing.", "error");
        }
    };

    return (
        <div className="max-w-6xl space-y-6">
            <SEO title="Listings" description="Listing moderation queue." path="/admin/listings" noindex />
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Listings</h1>
                <p className="text-sm text-muted-foreground">Moderation queue and active listing management.</p>
            </div>

            <div className="flex flex-wrap gap-2">
                {TABS.map((t) => (
                    <button key={t} onClick={() => { setStatus(t); list.setPage(1); }} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border ${status === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        {t.replace(/_/g, " ")}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search by title..." />
                <SortButton label="Newest" active={list.sort === "created_at"} order={list.order} onClick={() => { list.setSort("created_at"); list.setOrder(list.sort === "created_at" && list.order === "asc" ? "desc" : "asc"); }} />
                <SortButton label="Price" active={list.sort === "plan_cost"} order={list.order} onClick={() => { list.setSort("plan_cost"); list.setOrder(list.sort === "plan_cost" && list.order === "asc" ? "desc" : "asc"); }} />
            </div>

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border">
                    <p className="text-muted-foreground text-sm">{list.error ? `Could not load listings — ${list.error}` : "Nothing here."}</p>
                    {list.error && <button onClick={list.reload} className="mt-3 text-xs font-bold uppercase tracking-widest text-primary hover:underline">Retry</button>}
                </div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {list.items.map((l) => (
                        <div key={l.id} className="px-5 py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    {l.ss_services?.icon_url && <img src={l.ss_services.icon_url} alt="" className="w-8 h-8 object-contain shrink-0" />}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-sm truncate">{l.title}</p>
                                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">{l.short_id}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{money(l.plan_cost)} plan · {l.total_seats} seats total</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {status === "pending_review" && (
                                        <>
                                            <button onClick={() => act(l.id, "approve")} className="p-2 border border-border hover:bg-secondary text-primary" title="Approve"><Check size={14} /></button>
                                            <button onClick={() => act(l.id, "reject")} className="p-2 border border-border hover:bg-secondary text-rose-500" title="Reject"><X size={14} /></button>
                                        </>
                                    )}
                                    {status === "active" && (
                                        <button onClick={() => act(l.id, "suspend")} className="p-2 border border-border hover:bg-secondary text-amber-500" title="Suspend"><Pause size={14} /></button>
                                    )}
                                    <button onClick={() => setExpandedId(expandedId === l.id ? null : l.id)} className="p-2 border border-border hover:bg-secondary text-muted-foreground" title="View seats & conversations">
                                        {expandedId === l.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                </div>
                            </div>
                            <ListingSummary l={l} />
                            {expandedId === l.id && <ListingSeats listingId={l.id} />}
                        </div>
                    ))}
                </div>
            )}
            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
        </div>
    );
}
