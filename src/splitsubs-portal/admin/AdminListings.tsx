import { useState } from "react";
import { RefreshCw, Check, X, Pause } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";

const TABS = ["pending_review", "active", "paused", "suspended", "rejected"];

export function AdminListings() {
    const { showToast } = useToast();
    const [status, setStatus] = useState("pending_review");
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
        <div className="max-w-4xl space-y-6">
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
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">Nothing here.</p></div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {list.items.map((l) => (
                        <div key={l.id} className="flex items-center justify-between px-5 py-4">
                            <div>
                                <p className="font-medium text-sm">{l.title}</p>
                                <p className="text-xs text-muted-foreground">{l.ss_services?.name} · ₦{Number(l.plan_cost).toLocaleString()} / {l.total_seats} seats</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {status === "pending_review" && (
                                    <>
                                        <button onClick={() => act(l.id, "approve")} className="p-2 border border-border hover:bg-secondary text-primary" title="Approve"><Check size={14} /></button>
                                        <button onClick={() => act(l.id, "reject")} className="p-2 border border-border hover:bg-secondary text-rose-500" title="Reject"><X size={14} /></button>
                                    </>
                                )}
                                {status === "active" && (
                                    <button onClick={() => act(l.id, "suspend")} className="p-2 border border-border hover:bg-secondary text-amber-500" title="Suspend"><Pause size={14} /></button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
        </div>
    );
}
