import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus, X, ExternalLink, Power, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "../../app/components/Toast";
import { adminFetch, ApiError } from "../lib/api";

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

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            await adminFetch("/api/admin/events", { method: "POST", body: JSON.stringify(form) });
            showToast(`"${form.title}" created. Add credentials from its event page next.`, "success");
            setShowCreate(false);
            setForm({ title: "", organizerName: "", organizerEmail: "", websiteUrl: "" });
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
                            Never listed publicly. You'll add day(s) and issue credentials after this.
                        </p>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Event Title
                                </label>
                                <input
                                    required
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
                                    value={form.websiteUrl}
                                    onChange={(e) => setForm((p) => ({ ...p, websiteUrl: e.target.value }))}
                                    className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Event Flier
                                </label>
                                <div className="border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                                    Upload wires to Supabase Storage's assets bucket, same as CV uploads.
                                </div>
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
