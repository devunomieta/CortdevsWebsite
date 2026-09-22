import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { RefreshCw, Wallet, Plus } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SortButton, Pagination } from "../components/ListControls";
import { SEO } from "../components/SEO";

const money = (n: number) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const STATUS_STYLE: Record<string, string> = {
    success: "text-primary",
    paid: "text-primary",
    pending: "text-amber-600",
    processing: "text-amber-600",
    failed: "text-rose-500",
};

const KIND_LABEL: Record<string, string> = {
    seat_payment: "Seat payment",
    wallet_topup: "Wallet top-up",
    wallet_spend: "Paid from wallet",
    wallet_refund: "Wallet refund",
    host_credit: "Earnings credit",
    host_debit: "Withdrawal",
};

function PrepaidWalletCard() {
    const { showToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [balance, setBalance] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [amount, setAmount] = useState("");
    const [isToppingUp, setIsToppingUp] = useState(false);

    const load = () => ssFetch("/api/splitsubs/prepaid-wallet").then((d) => setBalance(d.balance)).catch(() => { }).finally(() => setIsLoading(false));

    useEffect(() => {
        const ref = searchParams.get("topup_ref");
        if (ref) {
            ssFetch(`/api/splitsubs/prepaid-wallet?verifyRef=${ref}`)
                .then((d) => {
                    if (d.status === "success") showToast("Wallet funded — balance updated.", "success");
                    else if (d.status === "failed") showToast("That top-up didn't go through.", "error");
                })
                .finally(() => { setSearchParams({}, { replace: true }); load(); });
        } else {
            load();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleTopUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsToppingUp(true);
        try {
            const result = await ssFetch("/api/splitsubs/prepaid-wallet", { method: "POST", body: JSON.stringify({ action: "topup", amount: Number(amount) }) });
            if (result.authorizationUrl) window.location.href = result.authorizationUrl;
        } catch (err: any) {
            showToast(err.message || "Could not start top-up.", "error");
            setIsToppingUp(false);
        }
    };

    if (isLoading) return <div className="flex justify-center py-6"><RefreshCw className="animate-spin text-muted-foreground" size={18} /></div>;

    return (
        <div className="border border-border p-5 bg-card flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <Wallet size={20} className="text-primary" />
                <div>
                    <p className="text-2xl font-light">{money(balance || 0)}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Wallet balance — pay for seats instantly, no checkout</p>
                </div>
            </div>
            <form onSubmit={handleTopUp} className="flex items-center gap-2">
                <input type="number" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (₦)" className="w-32 px-3 py-2.5 bg-background border border-border outline-none focus:border-primary text-sm" />
                <button type="submit" disabled={isToppingUp} className="px-4 py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50">
                    {isToppingUp ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />} Top Up
                </button>
            </form>
        </div>
    );
}

export function Transactions() {
    const list = usePaginatedList<any>("/api/splitsubs/transactions", "transactions");

    return (
        <div className="max-w-6xl space-y-6">
            <SEO title="Transactions" description="Your SplitSubs purchase history and wallet balance." path="/dashboard/transactions" noindex />
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-light tracking-tight mb-1">Transactions</h1>
                    <p className="text-sm text-muted-foreground">Every seat payment, wallet top-up, and withdrawal on your account.</p>
                </div>
                <SortButton label="Newest" active={list.sort === "created_at"} order={list.order} onClick={() => { list.setSort("created_at"); list.setOrder(list.sort === "created_at" && list.order === "asc" ? "desc" : "asc"); }} />
            </div>

            <PrepaidWalletCard />

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">No transactions yet.</p></div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {list.items.map((t) => {
                        const isDebit = t.kind === "wallet_spend" || t.kind === "host_debit";
                        return (
                            <div key={t.id} className="flex items-center justify-between px-5 py-4 gap-4">
                                <div>
                                    <p className="font-medium text-sm">{t.service_name || KIND_LABEL[t.kind] || t.kind}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {t.listing_title ? `${t.listing_title} · ` : ""}{KIND_LABEL[t.kind] || t.kind}{t.source ? ` · ${t.source}` : ""} · {new Date(t.created_at).toLocaleString()}
                                    </p>
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
