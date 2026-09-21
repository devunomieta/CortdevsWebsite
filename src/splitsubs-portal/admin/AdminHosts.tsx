import { useState } from "react";
import { RefreshCw, ShieldCheck, ShieldOff, Check, X, Eye } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";
import { SEO } from "../components/SEO";

const KYC_TABS = ["all", "pending", "approved", "rejected", "unsubmitted"];

export function AdminHosts() {
    const { showToast } = useToast();
    const [kycTab, setKycTab] = useState("all");
    const [busyId, setBusyId] = useState<string | null>(null);
    const list = usePaginatedList<any>("/api/admin/splitsubs/hosts", "hosts", {
        extraParams: kycTab === "all" ? {} : { kycStatus: kycTab },
    });

    const setTier = async (id: string, verificationTier: string) => {
        try {
            await ssFetch("/api/admin/splitsubs/hosts", { method: "PATCH", body: JSON.stringify({ id, verificationTier }) });
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not update.", "error");
        }
    };

    const toggleBan = async (id: string, isBanned: boolean) => {
        try {
            await ssFetch("/api/admin/splitsubs/hosts", { method: "PATCH", body: JSON.stringify({ id, isBanned: !isBanned }) });
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not update.", "error");
        }
    };

    const resolveKyc = async (id: string, kycAction: "approve" | "reject") => {
        let kycRejectionReason: string | undefined;
        if (kycAction === "reject") {
            kycRejectionReason = window.prompt("Reason (shown to the user)?") || undefined;
            if (!kycRejectionReason) return;
        }
        setBusyId(id);
        try {
            await ssFetch("/api/admin/splitsubs/hosts", { method: "PATCH", body: JSON.stringify({ id, kycAction, kycRejectionReason }) });
            showToast(kycAction === "approve" ? "KYC approved." : "KYC rejected.", "success");
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not resolve KYC.", "error");
        } finally {
            setBusyId(null);
        }
    };

    const viewId = async (id: string) => {
        try {
            const result = await ssFetch(`/api/admin/splitsubs/hosts?id=${id}&revealKyc=1`);
            const p = result.profile;
            window.alert(
                `${(p.kyc_id_type || "ID").toUpperCase()}: ${result.kycIdNumber || "not on file"}\n` +
                `Legal name: ${p.legal_name || "—"}\n` +
                `Phone: ${p.phone || "—"}\n` +
                `Email: ${p.email || "—"}`
            );
            if (result.kycDocumentUrl) {
                window.open(result.kycDocumentUrl, "_blank", "noopener,noreferrer");
            } else {
                showToast("No NIN slip on file for this submission.", "warning");
            }
        } catch (err: any) {
            showToast(err.message || "Could not load ID.", "error");
        }
    };

    return (
        <div className="max-w-7xl space-y-6">
            <SEO title="Users" description="User verification, KYC review, and account management." path="/admin/hosts" noindex />
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Users</h1>
                <p className="text-sm text-muted-foreground">KYC review, verification tiers, ratings, strikes, and bans.</p>
            </div>

            <div className="flex flex-wrap gap-2">
                {KYC_TABS.map((t) => (
                    <button key={t} onClick={() => { setKycTab(t); list.setPage(1); }} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border ${kycTab === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        {t === "all" ? "All" : `KYC ${t}`}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search by email..." />
                <SortButton label="Newest" active={list.sort === "created_at"} order={list.order} onClick={() => { list.setSort("created_at"); list.setOrder(list.sort === "created_at" && list.order === "asc" ? "desc" : "asc"); }} />
                <SortButton label="Splits" active={list.sort === "completed_splits"} order={list.order} onClick={() => { list.setSort("completed_splits"); list.setOrder(list.sort === "completed_splits" && list.order === "asc" ? "desc" : "asc"); }} />
                <SortButton label="Strikes" active={list.sort === "strikes"} order={list.order} onClick={() => { list.setSort("strikes"); list.setOrder(list.sort === "strikes" && list.order === "asc" ? "desc" : "asc"); }} />
            </div>

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">No users match.</p></div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {list.items.map((h) => (
                        <div key={h.id} className="flex items-center justify-between px-5 py-4 gap-4">
                            <div>
                                <p className="font-medium text-sm">{h.email || h.id}{h.legal_name ? ` — ${h.legal_name}` : ""}</p>
                                <p className="text-xs text-muted-foreground">
                                    {h.completed_splits} splits · {h.rating_count > 0 ? (h.rating_sum / h.rating_count).toFixed(1) : "—"} rating · {h.strikes} strike(s)
                                    {h.bank_account_name ? ` · ${h.bank_account_name}` : " · no payout account"}
                                    {" · "}<span className={h.kyc_status === "approved" ? "text-primary" : h.kyc_status === "pending" ? "text-amber-600" : h.kyc_status === "rejected" ? "text-rose-500" : ""}>KYC {h.kyc_status}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {h.kyc_status === "pending" && (
                                    <>
                                        <button onClick={() => viewId(h.id)} className="p-2 border border-border hover:bg-secondary" title="View submitted ID"><Eye size={14} /></button>
                                        <button onClick={() => resolveKyc(h.id, "approve")} disabled={busyId === h.id} className="p-2 border border-border hover:bg-secondary text-primary" title="Approve KYC"><Check size={14} /></button>
                                        <button onClick={() => resolveKyc(h.id, "reject")} disabled={busyId === h.id} className="p-2 border border-border hover:bg-secondary text-rose-500" title="Reject KYC"><X size={14} /></button>
                                    </>
                                )}
                                <select value={h.verification_tier} onChange={(e) => setTier(h.id, e.target.value)} className="px-3 py-2 bg-background border border-border text-xs outline-none">
                                    <option value="basic">Basic</option>
                                    <option value="bank_verified">Bank verified</option>
                                    <option value="id_verified">ID verified</option>
                                </select>
                                <button onClick={() => toggleBan(h.id, h.is_banned)} className={`p-2 border border-border hover:bg-secondary ${h.is_banned ? "text-rose-500" : "text-muted-foreground"}`} title={h.is_banned ? "Unban" : "Ban"}>
                                    {h.is_banned ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
        </div>
    );
}
