import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";

export function AdminHosts() {
    const { showToast } = useToast();
    const [hosts, setHosts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const load = () => ssFetch("/api/admin/splitsubs/hosts").then((d) => setHosts(d.hosts || [])).catch(() => { }).finally(() => setIsLoading(false));
    useEffect(() => { load(); }, []);

    const setTier = async (id: string, verificationTier: string) => {
        try {
            await ssFetch("/api/admin/splitsubs/hosts", { method: "PATCH", body: JSON.stringify({ id, verificationTier }) });
            load();
        } catch (err: any) {
            showToast(err.message || "Could not update.", "error");
        }
    };

    const toggleBan = async (id: string, isBanned: boolean) => {
        try {
            await ssFetch("/api/admin/splitsubs/hosts", { method: "PATCH", body: JSON.stringify({ id, isBanned: !isBanned }) });
            load();
        } catch (err: any) {
            showToast(err.message || "Could not update.", "error");
        }
    };

    return (
        <div className="max-w-5xl space-y-6">
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Hosts</h1>
                <p className="text-sm text-muted-foreground">Verification tiers, ratings, strikes, and bans.</p>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {hosts.map((h) => (
                        <div key={h.id} className="flex items-center justify-between px-5 py-4 gap-4">
                            <div>
                                <p className="font-medium text-sm">{h.email || h.id}</p>
                                <p className="text-xs text-muted-foreground">
                                    {h.completed_splits} splits · {h.rating_count > 0 ? (h.rating_sum / h.rating_count).toFixed(1) : "—"} rating · {h.strikes} strike(s)
                                    {h.bank_account_name ? ` · ${h.bank_account_name}` : " · no payout account"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
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
        </div>
    );
}
