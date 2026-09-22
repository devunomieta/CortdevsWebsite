import { RefreshCw } from "lucide-react";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";
import { SEO } from "../components/SEO";

export function AdminServiceRequests() {
    const list = usePaginatedList<any>("/api/admin/splitsubs/service-requests", "requests");

    return (
        <div className="max-w-5xl space-y-6">
            <SEO title="Service Requests" description="What users are asking SplitSubs to support." path="/admin/service-requests" noindex />
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Service Requests</h1>
                <p className="text-sm text-muted-foreground">Demand signals from the public "request a service / country" form — anonymous, admin-reviewed only.</p>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search by email, service, or country..." />
                <SortButton label="Newest" active={list.sort === "created_at"} order={list.order} onClick={() => { list.setSort("created_at"); list.setOrder(list.sort === "created_at" && list.order === "asc" ? "desc" : "asc"); }} />
            </div>

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">No requests yet.</p></div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {list.items.map((r) => (
                        <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-2 sm:gap-4">
                            <div className="min-w-0">
                                <p className="font-medium text-sm">{r.name || r.email}</p>
                                <p className="text-xs text-muted-foreground">{r.email}</p>
                            </div>
                            <div className="text-left sm:text-right text-xs text-muted-foreground shrink-0">
                                {r.requested_service && <p>Service: <span className="text-foreground font-medium">{r.requested_service}</span></p>}
                                {r.requested_country && <p>Country: <span className="text-foreground font-medium">{r.requested_country}</span></p>}
                                <p className="mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
        </div>
    );
}
