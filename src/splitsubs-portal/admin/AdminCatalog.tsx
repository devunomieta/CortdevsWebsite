import { useEffect, useState } from "react";
import { RefreshCw, Plus, Power } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";

const DEFAULT_FIELDS_HELP = '[{"key":"email","label":"Email","type":"email","required":true}]';

function ServiceForm({ onSaved }: { onSaved: () => void }) {
    const { showToast } = useToast();
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [maxSeats, setMaxSeats] = useState("4");
    const [defaultChargeRate, setDefaultChargeRate] = useState("0.15");
    const [riskTier, setRiskTier] = useState("medium");
    const [hostFields, setHostFields] = useState("[]");
    const [joinerFields, setJoinerFields] = useState(DEFAULT_FIELDS_HELP);
    const [riskNote, setRiskNote] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const hostFieldsJson = JSON.parse(hostFields || "[]");
            const joinerFieldsJson = JSON.parse(joinerFields || "[]");
            await ssFetch("/api/admin/splitsubs/services", {
                method: "POST",
                body: JSON.stringify({ name, category, maxSeats: Number(maxSeats), defaultChargeRate: Number(defaultChargeRate), riskTier, hostFields: hostFieldsJson, joinerFields: joinerFieldsJson, riskNote }),
            });
            showToast("Service added to catalog.", "success");
            onSaved();
        } catch (err: any) {
            showToast(err.message || "Check your JSON field definitions.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="border border-border p-6 bg-card space-y-4">
            <h3 className="font-medium">Add a service</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Name</label>
                    <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</label>
                    <input required value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Streaming, Music, ..." className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Max seats</label>
                    <input required type="number" min={2} max={20} value={maxSeats} onChange={(e) => setMaxSeats(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Charge rate (0–0.5)</label>
                    <input required type="number" step="0.01" min={0} max={0.5} value={defaultChargeRate} onChange={(e) => setDefaultChargeRate(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Risk tier</label>
                    <select value={riskTier} onChange={(e) => setRiskTier(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Host fields (JSON)</label>
                    <textarea value={hostFields} onChange={(e) => setHostFields(e.target.value)} rows={4} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-xs font-mono resize-none" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Joiner fields (JSON)</label>
                    <textarea value={joinerFields} onChange={(e) => setJoinerFields(e.target.value)} rows={4} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-xs font-mono resize-none" />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Risk note (shown internally)</label>
                <input value={riskNote} onChange={(e) => setRiskNote(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
            </div>
            <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
                {isSubmitting && <RefreshCw size={14} className="animate-spin" />} Add Service
            </button>
        </form>
    );
}

export function AdminCatalog() {
    const { showToast } = useToast();
    const [services, setServices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const load = () => ssFetch("/api/admin/splitsubs/services").then((d) => setServices(d.services || [])).catch(() => { }).finally(() => setIsLoading(false));
    useEffect(() => { load(); }, []);

    const toggleStatus = async (id: string, status: string) => {
        try {
            await ssFetch("/api/admin/splitsubs/services", { method: "PATCH", body: JSON.stringify({ id, status: status === "active" ? "inactive" : "active" }) });
            load();
        } catch (err: any) {
            showToast(err.message || "Could not update service.", "error");
        }
    };

    return (
        <div className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-light tracking-tight mb-1">Service Catalog</h1>
                    <p className="text-sm text-muted-foreground">What hosts can list and joiners can join.</p>
                </div>
                <button onClick={() => setShowForm((v) => !v)} className="px-4 py-2.5 border border-border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-secondary">
                    <Plus size={14} /> {showForm ? "Cancel" : "Add Service"}
                </button>
            </div>

            {showForm && <ServiceForm onSaved={() => { setShowForm(false); load(); }} />}

            {isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {services.map((s) => (
                        <div key={s.id} className="flex items-center justify-between px-5 py-4">
                            <div>
                                <p className="font-medium text-sm">{s.name}</p>
                                <p className="text-xs text-muted-foreground">{s.category} · up to {s.max_seats} seats · {(s.default_charge_rate * 100).toFixed(0)}% charge · {s.risk_tier} risk</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 ${s.status === "active" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{s.status}</span>
                                <button onClick={() => toggleStatus(s.id, s.status)} className="p-2 border border-border hover:bg-secondary" title="Toggle status"><Power size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
