import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus, X, ExternalLink, Power, AlertTriangle, RefreshCw, Trash2, Image as ImageIcon } from "lucide-react";
import { useToast } from "../../app/components/Toast";
import { adminFetch, ApiError } from "../lib/api";
import { supabase } from "../../lib/supabase";
import { isValidEmail, isValidUrl, isValidFieldName, LIMITS } from "../lib/validation";

interface DayInput { date: string; label: string; }

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function slugify(title: string) {
    return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface EventRow {
    id: string;
    title: string;
    slug: string;
    organizer_name: string;
    status: "active" | "disabled" | "archived";
    dayCount: number;
    checkedIn: number;
}

export function AdminOverview() {
    const { showToast } = useToast();
    const [events, setEvents] = useState<EventRow[] | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState({ title: "", organizerName: "", organizerEmail: "", websiteUrl: "" });
    const [days, setDays] = useState<DayInput[]>([{ date: todayISO(), label: "Day 1" }]);
    const [flierFile, setFlierFile] = useState<File | null>(null);
    const [flierPreview, setFlierPreview] = useState<string | null>(null);
    const [customFields, setCustomFields] = useState<string[]>([]);
    const [newFieldName, setNewFieldName] = useState("");

    const addDay = () => setDays((prev) => [...prev, { date: todayISO(), label: `Day ${prev.length + 1}` }]);
    const removeDay = (index: number) => setDays((prev) => prev.filter((_, i) => i !== index));
    const updateDay = (index: number, patch: Partial<DayInput>) =>
        setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));

    const addCustomField = () => {
        const name = newFieldName.trim();
        if (!name) return;
        if (!isValidFieldName(name)) {
            showToast("Field names can only use letters, numbers, spaces, and basic punctuation, up to 40 characters.", "error");
            return;
        }
        if (customFields.some((f) => f.toLowerCase() === name.toLowerCase())) {
            showToast("That field already exists.", "error");
            return;
        }
        setCustomFields((prev) => [...prev, name]);
        setNewFieldName("");
    };
    const removeCustomField = (name: string) => setCustomFields((prev) => prev.filter((f) => f !== name));

    const handleFlierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setFlierFile(file);
        setFlierPreview(file ? URL.createObjectURL(file) : null);
    };

    const loadEvents = () => {
        adminFetch("/api/admin/events")
            .then((data) => setEvents(data.events))
            .catch((err) => showToast(err instanceof ApiError ? err.message : "Could not load events.", "error"));
    };

    useEffect(() => { loadEvents(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleStatus = async (event: EventRow) => {
        const next = event.status === "active" ? "disabled" : "active";
        try {
            await adminFetch("/api/admin/events/update", { method: "POST", body: JSON.stringify({ id: event.id, status: next }) });
            setEvents((prev) => prev!.map((e) => (e.id === event.id ? { ...e, status: next } : e)));
            showToast(
                next === "disabled" ? "Dashboard disabled — the event login now shows access-revoked." : "Dashboard re-enabled.",
                next === "disabled" ? "warning" : "success"
            );
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not update event.", "error");
        }
    };

    const deleteEvent = async (event: EventRow) => {
        const confirmed = confirm(
            `Permanently delete "${event.title}"? This also deletes every login, attendee, check-in, and upload for this event. There's no undo.`
        );
        if (!confirmed) return;
        try {
            await adminFetch(`/api/admin/events?id=${event.id}`, { method: "DELETE" });
            setEvents((prev) => prev!.filter((e) => e.id !== event.id));
            showToast(`"${event.title}" deleted.`, "warning");
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not delete this event.", "error");
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (days.length === 0) {
            showToast("Add at least one day.", "error");
            return;
        }
        if (days.some((d) => !d.date || !d.label.trim())) {
            showToast("Every day needs both a date and a label.", "error");
            return;
        }
        if (!isValidEmail(form.organizerEmail)) {
            showToast("Organizer email doesn't look valid.", "error");
            return;
        }
        if (form.websiteUrl && !isValidUrl(form.websiteUrl)) {
            showToast("Website must be a full http(s) link.", "error");
            return;
        }
        setIsCreating(true);
        try {
            let flierUrl: string | null = null;
            if (flierFile) {
                const ext = flierFile.name.split(".").pop();
                const path = `event-fliers/${slugify(form.title) || "event"}-${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage.from("assets").upload(path, flierFile, { upsert: true });
                if (uploadError) throw new ApiError(`Flier upload failed: ${uploadError.message}`);
                flierUrl = supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;
            }

            await adminFetch("/api/admin/events", { method: "POST", body: JSON.stringify({ ...form, flierUrl, days, walkinFields: customFields }) });
            showToast(`"${form.title}" created. Add logins from its event page next.`, "success");
            setShowCreate(false);
            setForm({ title: "", organizerName: "", organizerEmail: "", websiteUrl: "" });
            setDays([{ date: todayISO(), label: "Day 1" }]);
            setFlierFile(null);
            setFlierPreview(null);
            setCustomFields([]);
            loadEvents();
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not create event.", "error");
        } finally {
            setIsCreating(false);
        }
    };

    if (events === null) {
        return (
            <div className="flex items-center justify-center py-24">
                <RefreshCw className="animate-spin text-primary" size={22} />
            </div>
        );
    }

    const disabledCount = events.filter((e) => e.status === "disabled").length;
    const totalCheckedIn = events.reduce((sum, e) => sum + e.checkedIn, 0);

    return (
        <div className="space-y-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-light tracking-tight">Events</h1>
                    <p className="text-sm text-muted-foreground mt-1">Every event Cortdevs is running attendance for.</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                >
                    <Plus size={14} /> New Event
                </button>
            </div>

            {/* Org-wide stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border border-border p-6 bg-card">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Active Events</p>
                    <p className="text-3xl font-light">{events.filter((e) => e.status === "active").length}</p>
                </div>
                <div className="border border-border p-6 bg-card">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Checked In (All Events)</p>
                    <p className="text-3xl font-light">{totalCheckedIn}</p>
                </div>
                <div className="border border-border p-6 bg-card">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Needs Attention</p>
                    <p className="text-3xl font-light">{disabledCount}</p>
                </div>
            </div>

            {/* Events list */}
            {events.length === 0 ? (
                <div className="border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                    No events yet. Create the first one above.
                </div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {events.map((event) => (
                        <div key={event.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <p className="font-medium truncate">{event.title}</p>
                                    <span
                                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 ${event.status === "active"
                                                ? "bg-emerald-500/10 text-emerald-600"
                                                : event.status === "disabled"
                                                    ? "bg-destructive/10 text-destructive"
                                                    : "bg-muted text-muted-foreground"
                                            }`}
                                    >
                                        {event.status}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                    /e/{event.slug} · {event.dayCount} day(s) · {event.organizer_name} · {event.checkedIn} checked in
                                </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                {event.status !== "archived" && (
                                    <button
                                        onClick={() => toggleStatus(event)}
                                        title={event.status === "active" ? "Disable dashboard" : "Re-enable dashboard"}
                                        className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest border transition-colors ${event.status === "active"
                                                ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                                                : "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                                            }`}
                                    >
                                        <Power size={13} /> {event.status === "active" ? "Disable" : "Enable"}
                                    </button>
                                )}
                                <Link
                                    to={`/admin/events/${event.id}`}
                                    className="px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all whitespace-nowrap"
                                >
                                    Manage
                                </Link>
                                <a
                                    href={`/e/${event.slug}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    title="Open event login"
                                >
                                    <ExternalLink size={16} />
                                </a>
                                <button
                                    onClick={() => deleteEvent(event)}
                                    title="Delete event permanently"
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {disabledCount > 0 && (
                <div className="flex items-start gap-3 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <p>{disabledCount} event dashboard{disabledCount === 1 ? " is" : "s are"} currently disabled.</p>
                </div>
            )}

            {/* Create event modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
                    <div className="w-full max-w-lg bg-card border border-border p-8 relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setShowCreate(false)}
                            className="absolute top-6 right-6 text-muted-foreground hover:text-foreground"
                        >
                            <X size={18} />
                        </button>
                        <h3 className="text-xl font-medium mb-1">New Event</h3>
                        <p className="text-xs text-muted-foreground mb-6">
                            Never listed publicly. You can add day(s) and logins after this.
                        </p>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Event Title
                                </label>
                                <input
                                    required
                                    maxLength={LIMITS.title}
                                    value={form.title}
                                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                                    placeholder="e.g. Cortdevs Demo Day 2026"
                                    className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                />
                                {form.title && (
                                    <p className="text-[10px] text-muted-foreground">
                                        Slug: /e/{form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Organizer Name
                                    </label>
                                    <input
                                        required
                                        maxLength={LIMITS.name}
                                        value={form.organizerName}
                                        onChange={(e) => setForm((p) => ({ ...p, organizerName: e.target.value }))}
                                        className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Organizer Email
                                    </label>
                                    <input
                                        required
                                        type="email"
                                        maxLength={200}
                                        value={form.organizerEmail}
                                        onChange={(e) => setForm((p) => ({ ...p, organizerEmail: e.target.value }))}
                                        className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Event Website (optional)
                                </label>
                                <input
                                    type="url"
                                    maxLength={LIMITS.url}
                                    placeholder="https://…"
                                    value={form.websiteUrl}
                                    onChange={(e) => setForm((p) => ({ ...p, websiteUrl: e.target.value }))}
                                    className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Day(s) &amp; Date(s)
                                    </label>
                                    <button type="button" onClick={addDay} className="text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-70">
                                        + Add Day
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {days.map((day, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <input
                                                type="date"
                                                required
                                                value={day.date}
                                                onChange={(e) => updateDay(i, { date: e.target.value })}
                                                className="px-3 py-2.5 bg-background border border-border outline-none focus:border-primary text-sm"
                                            />
                                            <input
                                                required
                                                maxLength={LIMITS.label}
                                                value={day.label}
                                                onChange={(e) => updateDay(i, { label: e.target.value })}
                                                placeholder="e.g. Day 1 — Showcase"
                                                className="flex-1 px-3 py-2.5 bg-background border border-border outline-none focus:border-primary text-sm min-w-0"
                                            />
                                            {days.length > 1 && (
                                                <button type="button" onClick={() => removeDay(i)} className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Custom Walk-in Fields (optional)
                                </label>
                                <p className="text-[11px] text-muted-foreground">
                                    Beyond name, email, and phone — e.g. "Company" or "T-shirt size". These also
                                    become the extra columns in this event's CSV import/export.
                                </p>
                                {customFields.length > 0 && (
                                    <div className="flex flex-wrap gap-2 py-1">
                                        {customFields.map((field) => (
                                            <span key={field} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-secondary text-xs font-medium">
                                                {field}
                                                <button type="button" onClick={() => removeCustomField(field)} className="text-muted-foreground hover:text-destructive transition-colors">
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input
                                        maxLength={LIMITS.fieldName}
                                        value={newFieldName}
                                        onChange={(e) => setNewFieldName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomField(); } }}
                                        placeholder="e.g. Company"
                                        className="flex-1 px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm min-w-0"
                                    />
                                    <button type="button" onClick={addCustomField} className="px-4 py-3 border border-border text-xs font-bold uppercase tracking-widest hover:bg-muted transition-colors shrink-0">
                                        Add Field
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Event Flier (optional)
                                </label>
                                {flierPreview ? (
                                    <div className="relative border border-border p-2">
                                        <img src={flierPreview} alt="Flier preview" className="w-full max-h-40 object-contain" />
                                        <button
                                            type="button"
                                            onClick={() => { setFlierFile(null); setFlierPreview(null); }}
                                            className="absolute top-2 right-2 p-1.5 bg-black/70 text-white"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="border border-dashed border-border p-6 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground cursor-pointer hover:border-primary transition-colors">
                                        <ImageIcon size={20} />
                                        Click to upload a flier image
                                        <input type="file" accept="image/*" onChange={handleFlierChange} className="hidden" />
                                    </label>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isCreating}
                                className="w-full py-3.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                            >
                                {isCreating ? "Creating…" : "Create Event"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
