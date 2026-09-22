import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, Pagination } from "../components/ListControls";
import { AdminSeatChatViewer } from "./AdminSeatChatViewer";
import { SEO } from "../components/SEO";

const TABS = ["open", "resolved", "all"];

export function AdminDisputes() {
    const { showToast } = useToast();
    const [filter, setFilter] = useState("open");
    const [busyId, setBusyId] = useState<string | null>(null);
    const list = usePaginatedList<any>("/api/admin/splitsubs/disputes", "disputes", { extraParams: { filter } });

    const resolve = async (id: string, resolution: string) => {
        const notes = window.prompt("Resolution notes (sent to both parties)?") || undefined;
        setBusyId(id);
        try {
            await ssFetch("/api/admin/splitsubs/disputes", { method: "PATCH", body: JSON.stringify({ id, resolution, notes }) });
            showToast("Dispute resolved.", "success");
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not resolve dispute.", "error");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="max-w-6xl space-y-6">
            <SEO title="Disputes" description="Dispute resolution queue." path="/admin/disputes" noindex />
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Disputes</h1>
                <p className="text-sm text-muted-foreground">Escrow is frozen on every open dispute below until you resolve it.</p>
            </div>

            <div className="flex flex-wrap gap-2">
                {TABS.map((t) => (
                    <button key={t} onClick={() => { setFilter(t); list.setPage(1); }} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border ${filter === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        {t}
                    </button>
                ))}
            </div>

            <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search by reason..." />

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">Nothing here.</p></div>
            ) : (
                <div className="space-y-4">
                    {list.items.map((d) => {
                        const isOpen = ["open", "investigating"].includes(d.status);
                        return (
                            <div key={d.id} className={`border p-5 ${isOpen ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card"}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <p className="font-medium text-sm">{d.ss_seats?.ss_listings?.title}</p>
                                    {!isOpen && <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{d.status.replace(/_/g, " ")}</span>}
                                </div>
                                <p className="text-xs text-muted-foreground mb-1">Seat total: ₦{Number(d.ss_seats?.total_paid || 0).toLocaleString()}</p>
                                <p className="text-sm mb-4">"{d.reason}"{d.details ? ` — ${d.details}` : ""}</p>
                                {d.seat_id && <div className="mb-4"><AdminSeatChatViewer seatId={d.seat_id} /></div>}
                                {isOpen && (
                                    <div className="flex flex-wrap gap-2">
                                        <button disabled={busyId === d.id} onClick={() => resolve(d.id, "resolved_refund")} className="px-4 py-2 bg-destructive text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">Refund joiner</button>
                                        <button disabled={busyId === d.id} onClick={() => resolve(d.id, "resolved_release")} className="px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">Release to host</button>
                                        <button disabled={busyId === d.id} onClick={() => resolve(d.id, "dismissed")} className="px-4 py-2 border border-border text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">Dismiss</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
        </div>
    );
}
