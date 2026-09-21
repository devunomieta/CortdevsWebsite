import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";
import { SEO } from "../components/SEO";

const ACTOR_TABS = ["all", "admin", "host", "joiner", "system"];

export function AdminAuditLog() {
    const [actorType, setActorType] = useState("all");
    const list = usePaginatedList<any>("/api/admin/splitsubs/audit-log", "entries", {
        extraParams: actorType === "all" ? {} : { actorType },
    });

    return (
        <div className="max-w-7xl space-y-6">
            <SEO title="Audit Log" description="Platform audit log." path="/admin/audit-log" noindex />
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Audit Log</h1>
                <p className="text-sm text-muted-foreground">Every sensitive action — catalog edits, payouts, dispute resolutions, and reveals.</p>
            </div>

            <div className="flex flex-wrap gap-2">
                {ACTOR_TABS.map((t) => (
                    <button key={t} onClick={() => { setActorType(t); list.setPage(1); }} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border ${actorType === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        {t}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search by action or actor..." />
                <SortButton label="Newest" active={list.sort === "created_at"} order={list.order} onClick={() => { list.setSort("created_at"); list.setOrder(list.sort === "created_at" && list.order === "asc" ? "desc" : "asc"); }} />
            </div>

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">No entries match.</p></div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {list.items.map((e) => (
                        <div key={e.id} className="px-5 py-3 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm">{e.action}</p>
                                <p className="text-xs text-muted-foreground">{e.actor_label} · {e.actor_type}</p>
                            </div>
                            <p className="text-xs text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            )}
            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
        </div>
    );
}
