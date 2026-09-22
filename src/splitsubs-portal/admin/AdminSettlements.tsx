import { RefreshCw, Wallet, Lock } from "lucide-react";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";
import { SEO } from "../components/SEO";

const money = (n: number) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

export function AdminSettlements() {
    const list = usePaginatedList<any>("/api/admin/splitsubs/settlements", "hosts", { defaultSort: "balance", defaultOrder: "desc" });

    return (
        <div className="max-w-6xl space-y-6">
            <SEO title="Payouts" description="Host wallet balances." path="/admin/settlements" noindex />
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Payouts</h1>
                <p className="text-sm text-muted-foreground">Withdrawals are self-service from a host's wallet now — this is oversight, not a place to trigger one.</p>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search by host email..." />
                <SortButton label="Balance" active={list.sort === "balance"} order={list.order} onClick={() => { list.setSort("balance"); list.setOrder(list.sort === "balance" && list.order === "asc" ? "desc" : "asc"); }} />
                <SortButton label="Available" active={list.sort === "available"} order={list.order} onClick={() => { list.setSort("available"); list.setOrder(list.sort === "available" && list.order === "asc" ? "desc" : "asc"); }} />
                <SortButton label="Host" active={list.sort === "hostEmail"} order={list.order} onClick={() => { list.setSort("hostEmail"); list.setOrder(list.sort === "hostEmail" && list.order === "asc" ? "desc" : "asc"); }} />
            </div>

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">No wallet activity yet.</p></div>
            ) : (
                <div className="space-y-3">
                    {list.items.map((h) => (
                        <div key={h.hostId} className="border border-border p-5 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="min-w-0">
                                <p className="font-medium text-sm">{h.hostEmail || h.hostId}</p>
                                {!h.payoutReady && <p className="text-xs text-rose-500 mt-1">No verified payout account yet — can't withdraw even once eligible</p>}
                            </div>
                            <div className="flex flex-wrap items-center gap-5 shrink-0 text-left sm:text-right">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1 sm:justify-end"><Wallet size={11} /> Balance</p>
                                    <p className="font-semibold">{money(h.balance)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Available</p>
                                    <p className="font-semibold text-primary">{money(h.available)}</p>
                                </div>
                                {h.locked > 0 && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1 sm:justify-end"><Lock size={11} /> Locked</p>
                                        <p className="font-semibold text-muted-foreground">{money(h.locked)}</p>
                                    </div>
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
