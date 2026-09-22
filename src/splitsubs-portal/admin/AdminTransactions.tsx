import { useState } from "react";
import { useSearchParams } from "react-router";
import { RefreshCw } from "lucide-react";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";
import { SEO } from "../components/SEO";

const money = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const KIND_TABS = [
    { value: "", label: "All" },
    { value: "seat_payment", label: "Seat Payments" },
    { value: "wallet_topup", label: "Wallet Top-ups" },
    { value: "wallet_spend", label: "Wallet Spends" },
    { value: "wallet_refund", label: "Wallet Refunds" },
    { value: "host_credit", label: "Host Credits" },
    { value: "host_debit", label: "Withdrawals" },
];

const KIND_LABEL: Record<string, string> = {
    seat_payment: "Seat payment",
    wallet_topup: "Wallet top-up",
    wallet_spend: "Wallet spend",
    wallet_refund: "Wallet refund",
    host_credit: "Host credit",
    host_debit: "Withdrawal",
};

const STATUS_STYLE: Record<string, string> = {
    success: "text-primary",
    paid: "text-primary",
    pending: "text-amber-600",
    processing: "text-amber-600",
    failed: "text-rose-500",
};

export function AdminTransactions() {
    const [searchParams] = useSearchParams();
    const [kindTab, setKindTab] = useState(searchParams.get("kind") || "");
    const list = usePaginatedList<any>("/api/admin/splitsubs/transactions", "transactions", {
        extraParams: kindTab ? { kind: kindTab } : {},
    });

    return (
        <div className="max-w-7xl space-y-6">
            <SEO title="Transactions" description="Every money movement on the SplitSubs platform." path="/admin/transactions" noindex />
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Transactions</h1>
                <p className="text-sm text-muted-foreground">Every seat payment, wallet top-up/spend/refund, and host wallet credit/withdrawal — platform-wide.</p>
            </div>

            <div className="flex flex-wrap gap-2">
                {KIND_TABS.map((t) => (
                    <button key={t.value} onClick={() => { setKindTab(t.value); list.setPage(1); }} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border ${kindTab === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search by user email, listing, or reference..." />
                <SortButton label="Newest" active={list.sort === "created_at"} order={list.order} onClick={() => { list.setSort("created_at"); list.setOrder(list.sort === "created_at" && list.order === "asc" ? "desc" : "asc"); }} />
                <SortButton label="Amount" active={list.sort === "amount"} order={list.order} onClick={() => { list.setSort("amount"); list.setOrder(list.sort === "amount" && list.order === "asc" ? "desc" : "asc"); }} />
                <SortButton label="Status" active={list.sort === "status"} order={list.order} onClick={() => { list.setSort("status"); list.setOrder(list.sort === "status" && list.order === "asc" ? "desc" : "asc"); }} />
            </div>

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">No transactions match.</p></div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {list.items.map((t) => {
                        const isDebit = t.kind === "wallet_spend" || t.kind === "host_debit";
                        // Source only adds information for these two kinds
                        // (which provider/gateway; which reason a host wallet
                        // moved) — for wallet_topup/spend/refund it's always
                        // the same value the kind label already implies.
                        const showSource = t.source && (t.kind === "seat_payment" || t.kind === "host_credit" || t.kind === "host_debit");
                        const shortRef = t.reference && t.reference.length > 24 ? `${t.reference.slice(0, 12)}…${t.reference.slice(-6)}` : t.reference;
                        return (
                            <div key={t.id} className="flex items-center justify-between px-5 py-4 gap-4">
                                <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{t.user_email || "Unknown user"}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {KIND_LABEL[t.kind] || t.kind}{t.listing_title ? ` · ${t.listing_title}` : ""}{t.service_name ? ` (${t.service_name})` : ""}{showSource ? ` · ${t.source}` : ""} · {new Date(t.created_at).toLocaleString()}
                                    </p>
                                    {shortRef && <p className="text-[10px] text-muted-foreground font-mono truncate" title={t.reference}>{shortRef}</p>}
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-semibold">{isDebit ? "−" : ""}{money(t.amount)}</p>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${STATUS_STYLE[t.status] || "text-muted-foreground"}`}>{t.status}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
        </div>
    );
}
