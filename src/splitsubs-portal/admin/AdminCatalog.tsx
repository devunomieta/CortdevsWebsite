import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Plus, Pencil, Power, X } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";
import { SEO } from "../components/SEO";

interface DynField { key: string; label: string; type: string; required: boolean }

const DEFAULT_JOINER_FIELDS: DynField[] = [{ key: "email", label: "Email", type: "email", required: true }];

const fieldCls = "w-full px-3 py-2.5 bg-background border border-border outline-none focus:border-primary text-sm disabled:opacity-50";
// A select or input sitting next to another field in a flex row can't reuse
// fieldCls — combining its baked-in w-full with a width override in the same
// class string is a coin flip in Tailwind's generated CSS (whichever utility
// happens to come later in the stylesheet wins, not whichever is listed last
// in the JSX), which is exactly what made the billing-cycle row overflow the
// modal. These two are built with no width utility of their own instead.
const narrowNumCls = "px-2 py-2.5 bg-background border border-border outline-none focus:border-primary text-sm text-center disabled:opacity-50";
const selectFlexCls = "px-3 py-2.5 bg-background border border-border outline-none focus:border-primary text-sm disabled:opacity-50 flex-1 min-w-0";
const labelCls = "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
const hintCls = "text-xs text-muted-foreground";
const sectionCls = "text-[10px] font-bold uppercase tracking-[0.2em] text-primary pt-1 first:pt-0";

function slugifyKey(label: string): string {
    return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") || "field";
}

// Replaces raw "edit this JSON array" textareas with a plain form: an admin
// just types the question they want to ask and picks an answer type — the
// {key,label,type,required} shape it saves as is an implementation detail,
// not something a non-technical admin should ever have to think about.
function DynamicFieldsEditor({ label, hint, value, onChange, disabled }: { label: string; hint: string; value: DynField[]; onChange: (v: DynField[]) => void; disabled?: boolean }) {
    const update = (i: number, patch: Partial<DynField>) => onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
    const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
    const add = () => onChange([...value, { key: "", label: "", type: "text", required: false }]);

    return (
        <div className="space-y-1.5">
            <label className={labelCls}>{label}</label>
            <div className="space-y-2">
                {value.length === 0 && <p className={hintCls}>Nothing extra asked — leave it this way unless this service needs it.</p>}
                {value.map((f, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 border border-border p-2">
                        <input
                            disabled={disabled}
                            placeholder="What to ask for, e.g. Profile name"
                            value={f.label}
                            onChange={(e) => update(i, { label: e.target.value, key: slugifyKey(e.target.value) })}
                            className="flex-1 min-w-[140px] px-2 py-1.5 bg-background border border-border text-xs outline-none focus:border-primary disabled:opacity-50"
                        />
                        <select disabled={disabled} value={f.type} onChange={(e) => update(i, { type: e.target.value })} className="px-2 py-1.5 bg-background border border-border text-xs outline-none focus:border-primary disabled:opacity-50">
                            <option value="text">Text</option>
                            <option value="email">Email</option>
                            <option value="tel">Phone number</option>
                            <option value="url">Link</option>
                        </select>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                            <input type="checkbox" disabled={disabled} checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} className="accent-primary" /> Required
                        </label>
                        <button type="button" disabled={disabled} onClick={() => remove(i)} className="p-1.5 text-muted-foreground hover:text-destructive shrink-0" title="Remove"><X size={14} /></button>
                    </div>
                ))}
            </div>
            <button type="button" disabled={disabled} onClick={add} className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline">+ Add a question</button>
            <p className={hintCls}>{hint}</p>
        </div>
    );
}

function ServiceForm({ onSaved }: { onSaved: () => void }) {
    const { showToast } = useToast();
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [maxSeats, setMaxSeats] = useState("4");
    const [chargeRatePct, setChargeRatePct] = useState("15");
    const [riskTier, setRiskTier] = useState("medium");
    const [accessType, setAccessType] = useState("shared_login");
    const [iconUrl, setIconUrl] = useState("");
    const [defaultPlanCost, setDefaultPlanCost] = useState("");
    const [billingCycleUnit, setBillingCycleUnit] = useState("month");
    const [billingCycleCount, setBillingCycleCount] = useState("1");
    const [hostFields, setHostFields] = useState<DynField[]>([]);
    const [joinerFields, setJoinerFields] = useState<DynField[]>(DEFAULT_JOINER_FIELDS);
    const [riskNote, setRiskNote] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await ssFetch("/api/admin/splitsubs/services", {
                method: "POST",
                body: JSON.stringify({ name, category, maxSeats: Number(maxSeats), defaultChargeRate: Number(chargeRatePct) / 100, riskTier, accessType, iconUrl: iconUrl || undefined, defaultPlanCost: defaultPlanCost ? Number(defaultPlanCost) : undefined, billingCycleUnit, billingCycleCount: Number(billingCycleCount), hostFields, joinerFields, riskNote }),
            });
            showToast("Service added to catalog.", "success");
            onSaved();
        } catch (err: any) {
            showToast(err.message || "Could not add service.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="border border-border p-6 bg-card space-y-4">
            <h3 className="font-medium">Add a service</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className={labelCls}>Name</label>
                    <input required value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
                </div>
                <div className="space-y-1.5">
                    <label className={labelCls}>Category</label>
                    <input required list="ss-catalog-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Pick or type a new one" className={fieldCls} />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                    <label className={labelCls}>Max seats</label>
                    <input required type="number" min={2} max={20} value={maxSeats} onChange={(e) => setMaxSeats(e.target.value)} className={fieldCls} />
                </div>
                <div className="space-y-1.5">
                    <label className={labelCls}>Service charge %</label>
                    <input required type="number" step={1} min={0} max={50} value={chargeRatePct} onChange={(e) => setChargeRatePct(e.target.value)} className={fieldCls} />
                </div>
                <div className="space-y-1.5">
                    <label className={labelCls}>Risk tier</label>
                    <select value={riskTier} onChange={(e) => setRiskTier(e.target.value)} className={fieldCls}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className={labelCls}>Logo URL</label>
                    <input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="https://..." className={fieldCls} />
                </div>
                <div className="space-y-1.5">
                    <label className={labelCls}>Default plan cost (₦, optional)</label>
                    <input type="number" min={0} value={defaultPlanCost} onChange={(e) => setDefaultPlanCost(e.target.value)} placeholder="e.g. 7000" className={fieldCls} />
                    <p className={hintCls}>Pre-fills a host's plan cost field — they can still override it.</p>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className={labelCls}>Access type</label>
                    <select value={accessType} onChange={(e) => setAccessType(e.target.value)} className={fieldCls}>
                        <option value="shared_login">Shared login (credentials)</option>
                        <option value="invite">Invite link (accept to join)</option>
                    </select>
                    <p className={hintCls}>Shapes the wording of the access-granted email joiners receive.</p>
                </div>
                <div className="space-y-1.5">
                    <label className={labelCls}>Billing cycle</label>
                    <div className="flex items-center gap-2">
                        <span className={hintCls}>Every</span>
                        <input type="number" min={1} max={60} value={billingCycleCount} onChange={(e) => setBillingCycleCount(e.target.value)} className={`${narrowNumCls} w-14 shrink-0`} />
                        <select value={billingCycleUnit} onChange={(e) => setBillingCycleUnit(e.target.value)} className={selectFlexCls}>
                            <option value="day">day(s)</option>
                            <option value="week">week(s)</option>
                            <option value="month">month(s)</option>
                            <option value="quarter">quarter(s)</option>
                            <option value="biannual">half-year(s)</option>
                            <option value="year">year(s)</option>
                        </select>
                    </div>
                    <p className={hintCls}>How often this plan renews — drives the wallet withdrawal hold, not just display.</p>
                </div>
            </div>
            <DynamicFieldsEditor label="Ask hosts for" hint="Anything extra a host needs to provide when listing this service." value={hostFields} onChange={setHostFields} />
            <DynamicFieldsEditor label="Ask joiners for" hint="Anything a joiner needs to give the host to receive access, e.g. an email to invite." value={joinerFields} onChange={setJoinerFields} />
            <div className="space-y-1.5">
                <label className={labelCls}>Risk note</label>
                <input value={riskNote} onChange={(e) => setRiskNote(e.target.value)} className={fieldCls} />
                <p className={hintCls}>Internal only — never shown to hosts or joiners. Context for reviewers on why this service carries its risk tier.</p>
            </div>
            <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
                {isSubmitting && <RefreshCw size={14} className="animate-spin" />} Add Service
            </button>
        </form>
    );
}

function EditServiceModal({ service: s, onClose, onSaved }: { service: any; onClose: () => void; onSaved: () => void }) {
    const { showToast } = useToast();
    const [name, setName] = useState(s.name);
    const [category, setCategory] = useState(s.category);
    const [maxSeats, setMaxSeats] = useState(String(s.max_seats));
    const [chargeRatePct, setChargeRatePct] = useState(String(Math.round(s.default_charge_rate * 100)));
    const [riskTier, setRiskTier] = useState(s.risk_tier);
    const [accessType, setAccessType] = useState(s.access_type || "shared_login");
    const [iconUrl, setIconUrl] = useState(s.icon_url || "");
    const [defaultPlanCost, setDefaultPlanCost] = useState(s.default_plan_cost != null ? String(s.default_plan_cost) : "");
    const [billingCycleUnit, setBillingCycleUnit] = useState(s.billing_cycle_unit);
    const [billingCycleCount, setBillingCycleCount] = useState(String(s.billing_cycle_count));
    const [hostFields, setHostFields] = useState<DynField[]>(s.host_fields || []);
    const [joinerFields, setJoinerFields] = useState<DynField[]>(s.joiner_fields || []);
    const [riskNote, setRiskNote] = useState(s.risk_note || "");
    const [status, setStatus] = useState(s.status);
    const [isSaving, setIsSaving] = useState(false);
    const [isToggling, setIsToggling] = useState(false);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await ssFetch("/api/admin/splitsubs/services", {
                method: "PATCH",
                body: JSON.stringify({
                    id: s.id, name, category, maxSeats: Number(maxSeats), defaultChargeRate: Number(chargeRatePct) / 100, riskTier, accessType,
                    iconUrl: iconUrl || null, defaultPlanCost: defaultPlanCost ? Number(defaultPlanCost) : null,
                    billingCycleUnit, billingCycleCount: Number(billingCycleCount),
                    hostFields, joinerFields, riskNote: riskNote || null,
                }),
            });
            showToast("Service updated.", "success");
            onSaved();
            onClose();
        } catch (err: any) {
            showToast(err.message || "Could not save changes.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async () => {
        const next = status === "active" ? "inactive" : "active";
        setIsToggling(true);
        try {
            await ssFetch("/api/admin/splitsubs/services", { method: "PATCH", body: JSON.stringify({ id: s.id, status: next }) });
            setStatus(next);
            onSaved();
        } catch (err: any) {
            showToast(err.message || "Could not update status.", "error");
        } finally {
            setIsToggling(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card border border-border shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-3">
                        {s.icon_url && <img src={s.icon_url} alt="" className="w-8 h-8 object-contain" />}
                        <div>
                            <h3 className="font-medium">Edit service</h3>
                            <p className="text-xs text-muted-foreground">{s.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-secondary text-muted-foreground"><X size={16} /></button>
                </div>

                <form onSubmit={save} className="overflow-y-auto px-6 py-4 space-y-4">
                    <p className={sectionCls}>Identity</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className={labelCls}>Name</label>
                            <input required disabled={isSaving} value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Category</label>
                            <input required disabled={isSaving} list="ss-catalog-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Pick or type a new one" className={fieldCls} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className={labelCls}>Logo URL</label>
                        <input disabled={isSaving} value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="https://..." className={fieldCls} />
                    </div>

                    <p className={sectionCls}>Pricing & risk</p>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                            <label className={labelCls}>Max seats</label>
                            <input required disabled={isSaving} type="number" min={2} max={20} value={maxSeats} onChange={(e) => setMaxSeats(e.target.value)} className={fieldCls} />
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Service charge %</label>
                            <input required disabled={isSaving} type="number" min={0} max={50} value={chargeRatePct} onChange={(e) => setChargeRatePct(e.target.value)} className={fieldCls} />
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Risk tier</label>
                            <select disabled={isSaving} value={riskTier} onChange={(e) => setRiskTier(e.target.value)} className={fieldCls}>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Default price (₦)</label>
                            <input disabled={isSaving} type="number" min={0} value={defaultPlanCost} onChange={(e) => setDefaultPlanCost(e.target.value)} placeholder="—" className={fieldCls} />
                        </div>
                    </div>

                    <p className={sectionCls}>Access & schedule</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className={labelCls}>Access type</label>
                            <select disabled={isSaving} value={accessType} onChange={(e) => setAccessType(e.target.value)} className={fieldCls}>
                                <option value="shared_login">Shared login (credentials)</option>
                                <option value="invite">Invite link (accept to join)</option>
                            </select>
                            <p className={hintCls}>Shapes the wording of the access-granted email joiners receive.</p>
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Billing cycle</label>
                            <div className="flex items-center gap-2">
                                <span className={hintCls}>Every</span>
                                <input disabled={isSaving} type="number" min={1} max={60} value={billingCycleCount} onChange={(e) => setBillingCycleCount(e.target.value)} className={`${narrowNumCls} w-14 shrink-0 disabled:opacity-50`} />
                                <select disabled={isSaving} value={billingCycleUnit} onChange={(e) => setBillingCycleUnit(e.target.value)} className={selectFlexCls}>
                                    <option value="day">day(s)</option>
                                    <option value="week">week(s)</option>
                                    <option value="month">month(s)</option>
                                    <option value="quarter">quarter(s)</option>
                                    <option value="biannual">half-year(s)</option>
                                    <option value="year">year(s)</option>
                                </select>
                            </div>
                            <p className={hintCls}>How often this plan renews — drives the wallet withdrawal hold.</p>
                        </div>
                    </div>

                    <p className={sectionCls}>What to ask for</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <DynamicFieldsEditor label="Ask hosts for" hint="Extra info a host must provide when listing this service." value={hostFields} onChange={setHostFields} disabled={isSaving} />
                        <DynamicFieldsEditor label="Ask joiners for" hint="What a joiner gives the host to receive access, e.g. an email to invite." value={joinerFields} onChange={setJoinerFields} disabled={isSaving} />
                    </div>
                    <div className="space-y-1.5">
                        <label className={labelCls}>Risk note</label>
                        <input disabled={isSaving} value={riskNote} onChange={(e) => setRiskNote(e.target.value)} className={fieldCls} />
                        <p className={hintCls}>Internal only — never shown to hosts or joiners. Context for reviewers on why this service carries its risk tier.</p>
                    </div>
                </form>

                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
                    <button type="button" onClick={toggleStatus} disabled={isToggling} className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 ${status === "active" ? "border border-destructive/40 text-destructive hover:bg-destructive/10" : "border border-primary/40 text-primary hover:bg-primary/10"}`}>
                        {isToggling ? <RefreshCw size={14} className="animate-spin" /> : <Power size={14} />} {status === "active" ? "Disable" : "Enable"}
                    </button>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2.5 border border-border text-[10px] font-bold uppercase tracking-widest hover:bg-secondary">Cancel</button>
                        <button onClick={save} disabled={isSaving} className="px-6 py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
                            {isSaving && <RefreshCw size={14} className="animate-spin" />} Save
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function formatCycle(s: any): string {
    const n = s.billing_cycle_count;
    const unit = s.billing_cycle_unit;
    return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
}

export function AdminCatalog() {
    const { showToast } = useToast();
    const [showForm, setShowForm] = useState(false);
    const [editingService, setEditingService] = useState<any>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const list = usePaginatedList<any>("/api/admin/splitsubs/services", "services", { defaultSort: "name", defaultOrder: "asc" });

    const loadCategories = () => {
        ssFetch("/api/admin/splitsubs/services?pageSize=500&sort=category&order=asc")
            .then((d) => setCategories(Array.from(new Set((d.services || []).map((s: any) => s.category))).sort() as string[]))
            .catch(() => { });
    };
    useEffect(loadCategories, []);

    const allOnPageSelected = list.items.length > 0 && list.items.every((s) => selectedIds.has(s.id));
    const toggleSelectAll = () => {
        setSelectedIds(allOnPageSelected ? new Set() : new Set(list.items.map((s) => s.id)));
    };
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const bulkSetStatus = async (status: "active" | "inactive") => {
        setIsBulkUpdating(true);
        try {
            await Promise.all(Array.from(selectedIds).map((id) => ssFetch("/api/admin/splitsubs/services", { method: "PATCH", body: JSON.stringify({ id, status }) })));
            showToast(`${selectedIds.size} service(s) ${status === "active" ? "enabled" : "disabled"}.`, "success");
            setSelectedIds(new Set());
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not update selected services.", "error");
        } finally {
            setIsBulkUpdating(false);
        }
    };

    return (
        <div className="max-w-6xl space-y-6">
            <SEO title="Service Catalog" description="Manage the SplitSubs service catalog." path="/admin/catalog" noindex />
            <datalist id="ss-catalog-categories">
                {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-light tracking-tight mb-1">Service Catalog</h1>
                    <p className="text-sm text-muted-foreground">What hosts can list and joiners can join.</p>
                    <p className="text-xs text-muted-foreground mt-1">"Charge %" is SplitSubs' cut, added on top of the seat price — joiners pay it, hosts don't. It's what makes the "100% payback" hosting model work.</p>
                </div>
                <button onClick={() => setShowForm((v) => !v)} className="shrink-0 px-4 py-2.5 border border-border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-secondary">
                    <Plus size={14} /> {showForm ? "Cancel" : "Add Service"}
                </button>
            </div>

            {showForm && <ServiceForm onSaved={() => { setShowForm(false); list.reload(); loadCategories(); }} />}

            <div className="flex flex-wrap gap-2 items-center">
                <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search by name or category..." />
                <SortButton label="Name" active={list.sort === "name"} order={list.order} onClick={() => { list.setSort("name"); list.setOrder(list.sort === "name" && list.order === "asc" ? "desc" : "asc"); }} />
                <SortButton label="Category" active={list.sort === "category"} order={list.order} onClick={() => { list.setSort("category"); list.setOrder(list.sort === "category" && list.order === "asc" ? "desc" : "asc"); }} />
                <SortButton label="Status" active={list.sort === "status"} order={list.order} onClick={() => { list.setSort("status"); list.setOrder(list.sort === "status" && list.order === "asc" ? "desc" : "asc"); }} />
            </div>

            {selectedIds.size > 0 && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-secondary/50 border border-border">
                    <span className="text-xs font-medium">{selectedIds.size} selected</span>
                    <div className="flex items-center gap-2">
                        <button disabled={isBulkUpdating} onClick={() => bulkSetStatus("active")} className="px-3 py-1.5 border border-primary/40 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 disabled:opacity-50 flex items-center gap-1.5">
                            {isBulkUpdating && <RefreshCw size={12} className="animate-spin" />} Enable
                        </button>
                        <button disabled={isBulkUpdating} onClick={() => bulkSetStatus("inactive")} className="px-3 py-1.5 border border-destructive/40 text-destructive text-[10px] font-bold uppercase tracking-widest hover:bg-destructive/10 disabled:opacity-50 flex items-center gap-1.5">
                            {isBulkUpdating && <RefreshCw size={12} className="animate-spin" />} Disable
                        </button>
                        <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">Clear</button>
                    </div>
                </div>
            )}

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">No services match.</p></div>
            ) : (
                <div className="border border-border bg-card overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-secondary/50 border-b border-border">
                                <th className="px-4 py-3 w-10">
                                    <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} className="accent-primary" />
                                </th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Service</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Seats</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Charge</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Price</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Cycle</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {list.items.map((s) => (
                                <tr key={s.id} className={`hover:bg-secondary/30 ${selectedIds.has(s.id) ? "bg-secondary/30" : ""}`}>
                                    <td className="px-4 py-3">
                                        <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} className="accent-primary" />
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            {s.icon_url && <img src={s.icon_url} alt="" className="w-6 h-6 object-contain shrink-0" />}
                                            <span className="font-medium">{s.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">up to {s.max_seats}</td>
                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{(s.default_charge_rate * 100).toFixed(0)}%</td>
                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{s.default_plan_cost != null ? `₦${Number(s.default_plan_cost).toLocaleString()}` : "—"}</td>
                                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatCycle(s)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 ${s.status === "active" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{s.status}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <button onClick={() => setEditingService(s)} className="p-2 border border-border hover:bg-secondary" title="Edit"><Pencil size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />

            <AnimatePresence>
                {editingService && (
                    <EditServiceModal service={editingService} onClose={() => setEditingService(null)} onSaved={() => { list.reload(); loadCategories(); }} />
                )}
            </AnimatePresence>
        </div>
    );
}
