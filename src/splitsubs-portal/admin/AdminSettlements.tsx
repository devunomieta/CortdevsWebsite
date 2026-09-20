import { useEffect, useState } from "react";
import { RefreshCw, Send } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";

const money = (n: number) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

export function AdminSettlements() {
    const { showToast } = useToast();
    const [hosts, setHosts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = () => ssFetch("/api/admin/splitsubs/settlements").then((d) => setHosts(d.hosts || [])).catch(() => { }).finally(() => setIsLoading(false));
    useEffect(() => { load(); }, []);

    const pay = async (hostId: string) => {
        setBusyId(hostId);
        try {
            const result = await ssFetch("/api/admin/splitsubs/settlements", { method: "POST", body: JSON.stringify({ hostId }) });
            showToast(`Payout of ${money(result.amount)} initiated.`, "success");
            load();
        } catch (err: any) {
            showToast(err.message || "Could not process payout.", "error");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Settlements</h1>
                <p className="text-sm text-muted-foreground">Pending payouts, grouped by host.</p>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : hosts.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">Nothing pending.</p></div>
            ) : (
                <div className="space-y-4">
                    {hosts.map((h) => (
                        <div key={h.hostId} className="border border-border p-5 bg-card flex items-center justify-between gap-4">
                            <div>
                                <p className="font-medium text-sm">{h.hostEmail || h.hostId}</p>
                                <p className="text-xs text-muted-foreground">{h.rows.length} seat(s) · {money(h.total)}</p>
                                {!h.payoutReady && <p className="text-xs text-rose-500 mt-1">No verified payout account yet</p>}
                            </div>
                            <button
                                onClick={() => pay(h.hostId)}
                                disabled={!h.payoutReady || busyId === h.hostId}
                                className="px-4 py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 shrink-0"
                            >
                                {busyId === h.hostId ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />} Pay out
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
