import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";

export function AdminDisputes() {
    const { showToast } = useToast();
    const [disputes, setDisputes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = () => ssFetch("/api/admin/splitsubs/disputes").then((d) => setDisputes(d.disputes || [])).catch(() => { }).finally(() => setIsLoading(false));
    useEffect(() => { load(); }, []);

    const resolve = async (id: string, resolution: string) => {
        const notes = window.prompt("Resolution notes (sent to both parties)?") || undefined;
        setBusyId(id);
        try {
            await ssFetch("/api/admin/splitsubs/disputes", { method: "PATCH", body: JSON.stringify({ id, resolution, notes }) });
            showToast("Dispute resolved.", "success");
            load();
        } catch (err: any) {
            showToast(err.message || "Could not resolve dispute.", "error");
        } finally {
            setBusyId(null);
        }
    };

    const open = disputes.filter((d) => ["open", "investigating"].includes(d.status));
    const resolved = disputes.filter((d) => !["open", "investigating"].includes(d.status));

    return (
        <div className="max-w-4xl space-y-10">
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Disputes</h1>
                <p className="text-sm text-muted-foreground">Escrow is frozen on every seat below until you resolve it.</p>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : (
                <>
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Open ({open.length})</h2>
                        {open.length === 0 && <p className="text-sm text-muted-foreground">Nothing open.</p>}
                        {open.map((d) => (
                            <div key={d.id} className="border border-amber-500/30 bg-amber-500/5 p-5">
                                <p className="font-medium text-sm mb-1">{d.ss_seats?.ss_listings?.title}</p>
                                <p className="text-xs text-muted-foreground mb-1">Seat total: ₦{Number(d.ss_seats?.total_paid || 0).toLocaleString()}</p>
                                <p className="text-sm mb-4">"{d.reason}"{d.details ? ` — ${d.details}` : ""}</p>
                                <div className="flex flex-wrap gap-2">
                                    <button disabled={busyId === d.id} onClick={() => resolve(d.id, "resolved_refund")} className="px-4 py-2 bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">Refund joiner</button>
                                    <button disabled={busyId === d.id} onClick={() => resolve(d.id, "resolved_release")} className="px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">Release to host</button>
                                    <button disabled={busyId === d.id} onClick={() => resolve(d.id, "dismissed")} className="px-4 py-2 border border-border text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">Dismiss</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Resolved</h2>
                        <div className="border border-border bg-card divide-y divide-border">
                            {resolved.map((d) => (
                                <div key={d.id} className="px-5 py-3 flex items-center justify-between text-sm">
                                    <span>{d.ss_seats?.ss_listings?.title}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{d.status.replace(/_/g, " ")}</span>
                                </div>
                            ))}
                            {resolved.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">None yet.</p>}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
