import { useState } from "react";
import { RefreshCw, Plus, Power } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";
import { SEO } from "../components/SEO";

const DEFAULT_FIELDS_HELP = '[{"key":"email","label":"Email","type":"email","required":true}]';

function ServiceForm({ onSaved }: { onSaved: () => void }) {
    const { showToast } = useToast();
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [maxSeats, setMaxSeats] = useState("4");
    const [defaultChargeRate, setDefaultChargeRate] = useState("0.15");
    const [riskTier, setRiskTier] = useState("medium");
    const [billingCycleUnit, setBillingCycleUnit] = useState("month");
    const [billingCycleCount, setBillingCycleCount] = useState("1");
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
                body: JSON.stringify({ name, category, maxSeats: Number(maxSeats), defaultChargeRate: Number(defaultChargeRate), riskTier, billingCycleUnit, billingCycleCount: Number(billingCycleCount), hostFields: hostFieldsJson, joinerFields: joinerFieldsJson, riskNote }),
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
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Billing cycle</label>
                    <div className="flex gap-2">
                        <input type="number" min={1} max={60} value={billingCycleCount} onChange={(e) => setBillingCycleCount(e.target.value)} className="w-20 px-3 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                        <select value={billingCycleUnit} onChange={(e) => setBillingCycleUnit(e.target.value)} className="flex-1 px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm">
                            <option value="day">Day(s)</option>
                            <option value="week">Week(s)</option>
                            <option value="month">Month(s)</option>
                            <option value="quarter">Quarter(s)</option>
                            <option value="biannual">Half-year(s)</option>
                            <option value="year">Year(s)</option>
                        </select>
                    </div>
                    <p className="text-xs text-muted-foreground">How often this plan renews — drives the wallet withdrawal hold, not just display.</p>
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
    const [showForm, setShowForm] = useState(false);
    const list = usePaginatedList<any>("/api/admin/splitsubs/services", "services", { defaultSort: "name", defaultOrder: "asc" });

    const toggleStatus = async (id: string, status: string) => {
        try {
            await ssFetch("/api/admin/splitsubs/services", { method: "PATCH", body: JSON.stringify({ id, status: status === "active" ? "inactive" : "active" }) });
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not update service.", "error");
        }
    };

    const updateCycle = async (id: string, billingCycleUnit: string, billingCycleCount: number) => {
        try {
            await ssFetch("/api/admin/splitsubs/services", { method: "PATCH", body: JSON.stringify({ id, billingCycleUnit, billingCycleCount }) });
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not update billing cycle.", "error");
        }
    };

    return (
        <div className="max-w-6xl space-y-6">
            <SEO title="Service Catalog" description="Manage the SplitSubs service catalog." path="/admin/catalog" noindex />
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-light tracking-tight mb-1">Service Catalog</h1>
                    <p className="text-sm text-muted-foreground">What hosts can list and joiners can join.</p>
                </div>
                <button onClick={() => setShowForm((v) => !v)} className="px-4 py-2.5 border border-border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-secondary">
                    <Plus size={14} /> {showForm ? "Cancel" : "Add Service"}
                </button>
            </div>

            {showForm && <ServiceForm onSaved={() => { setShowForm(false); list.reload(); }} />}

            <div className="flex flex-wrap gap-2 items-center">
                <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search by name or category..." />
                <SortButton label="Name" active={list.sort === "name"} order={list.order} onClick={() => { list.setSort("name"); list.setOrder(list.sort === "name" && list.order === "asc" ? "desc" : "asc"); }} />
                <SortButton label="Category" active={list.sort === "category"} order={list.order} onClick={() => { list.setSort("category"); list.setOrder(list.sort === "category" && list.order === "asc" ? "desc" : "asc"); }} />
                <SortButton label="Status" active={list.sort === "status"} order={list.order} onClick={() => { list.setSort("status"); list.setOrder(list.sort === "status" && list.order === "asc" ? "desc" : "asc"); }} />
            </div>

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">No services match.</p></div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {list.items.map((s) => (
                        <div key={s.id} className="flex items-center justify-between px-5 py-4">
                            <div>
                                <p className="font-medium text-sm">{s.name}</p>
                                <p className="text-xs text-muted-foreground">{s.category} · up to {s.max_seats} seats · {(s.default_charge_rate * 100).toFixed(0)}% charge · {s.risk_tier} risk</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1">
                                    <input type="number" min={1} max={60} defaultValue={s.billing_cycle_count} onBlur={(e) => updateCycle(s.id, s.billing_cycle_unit, Number(e.target.value))} className="w-14 px-2 py-2 bg-background border border-border text-xs outline-none" />
                                    <select value={s.billing_cycle_unit} onChange={(e) => updateCycle(s.id, e.target.value, s.billing_cycle_count)} className="px-2 py-2 bg-background border border-border text-xs outline-none">
                                        <option value="day">day(s)</option>
                                        <option value="week">week(s)</option>
                                        <option value="month">month(s)</option>
                                        <option value="quarter">quarter(s)</option>
                                        <option value="biannual">half-yr(s)</option>
                                        <option value="year">year(s)</option>
                                    </select>
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 ${s.status === "active" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{s.status}</span>
                                <button onClick={() => toggleStatus(s.id, s.status)} className="p-2 border border-border hover:bg-secondary" title="Toggle status"><Power size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
        </div>
    );
}
