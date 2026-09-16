import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";
import {
    Search,
    UserPlus,
    CheckCircle2,
    Clock,
    FileDown,
    FileUp,
    Download,
    X,
    RefreshCw,
    LayoutDashboard,
    ClipboardCheck,
    Settings2,
    Users,
    UserX,
    Repeat,
} from "lucide-react";
import { useToast } from "../../app/components/Toast";
import { eventFetch, ApiError } from "../lib/api";
import { subscribeToChannel } from "../lib/realtime";
import type { DashboardContext } from "./DashboardLayout";

type Tab = "analytics" | "checkin" | "manage";

interface SearchResult {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    source: "imported" | "walk-in";
    checkedInAt: string | null;
}

interface Analytics {
    totalGuests: number;
    checkedIn: number;
    newRegistrations: number;
    checkInRate: number;
    noShows: number;
    hourly: { hour: string; count: number }[];
    crossDay: { uniqueAttendees: number; totalCheckins: number } | null;
}

interface ExportStatus {
    id: string;
    status: "pending" | "approved" | "denied";
    requestedAt: string;
    fileUrl?: string | null;
}

interface ImportStatus {
    id: string;
    file_name: string;
    row_count: number;
    status: "pending" | "approved" | "denied";
    uploaded_at: string;
    imported_count?: number | null;
    skipped_count?: number | null;
}

const EMPTY_ANALYTICS: Analytics = { totalGuests: 0, checkedIn: 0, newRegistrations: 0, checkInRate: 0, noShows: 0, hourly: [], crossDay: null };

export function DashboardHome() {
    const ctx = useOutletContext<DashboardContext>();
    const { showToast } = useToast();
    const isFull = ctx.role === "full";

    const [tab, setTab] = useState<Tab>(isFull ? "checkin" : "analytics");
    const [activeDayId, setActiveDayId] = useState(ctx.days[0]?.id || "");
    const [analytics, setAnalytics] = useState<Analytics>(EMPTY_ANALYTICS);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showWalkIn, setShowWalkIn] = useState(false);
    const [walkInForm, setWalkInForm] = useState<Record<string, string>>({ fullName: "", email: "", phone: "" });
    const [latestExport, setLatestExport] = useState<ExportStatus | null>(null);
    const [latestImport, setLatestImport] = useState<ImportStatus | null>(null);
    const [isUploadingCsv, setIsUploadingCsv] = useState(false);

    const loadAnalytics = useCallback(async () => {
        if (!activeDayId) return;
        try {
            const data = await eventFetch(`/api/events/analytics?dayId=${activeDayId}`, ctx.token);
            setAnalytics(data);
        } catch {
            // non-critical to surface as an error toast on every poll
        }
    }, [activeDayId, ctx.token]);

    const loadExportStatus = useCallback(async () => {
        if (!isFull) return;
        try {
            const data = await eventFetch("/api/events/export-request", ctx.token);
            setLatestExport(data.latest);
        } catch {
            // non-critical
        }
    }, [ctx.token, isFull]);

    const loadImportStatus = useCallback(async () => {
        if (!isFull) return;
        try {
            const data = await eventFetch("/api/events/import-request", ctx.token);
            setLatestImport(data.latest);
        } catch {
            // non-critical
        }
    }, [ctx.token, isFull]);

    useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
    useEffect(() => { loadExportStatus(); }, [loadExportStatus]);
    useEffect(() => { loadImportStatus(); }, [loadImportStatus]);

    // Live multi-device sync: any check-in, or a decision on an export/import
    // request, re-triggers a refetch here — no one has to reload to see the
    // latest state.
    useEffect(() => {
        return subscribeToChannel(`event-${ctx.eventId}`, "update", (payload) => {
            if (payload?.kind === "export") { loadExportStatus(); return; }
            if (payload?.kind === "import") { loadImportStatus(); return; }
            loadAnalytics();
            if (query.trim()) runSearch(query);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx.eventId]);

    const runSearch = useCallback(async (q: string) => {
        if (!q.trim() || !activeDayId) {
            setResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const data = await eventFetch(`/api/events/attendees?q=${encodeURIComponent(q)}&dayId=${activeDayId}`, ctx.token);
            setResults(data.results);
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Search failed.", "error");
        } finally {
            setIsSearching(false);
        }
    }, [activeDayId, ctx.token, showToast]);

    useEffect(() => {
        const handle = setTimeout(() => runSearch(query), 300);
        return () => clearTimeout(handle);
    }, [query, runSearch]);

    const confirmCheckIn = async (attendee: SearchResult) => {
        try {
            const data = await eventFetch("/api/events/attendance", ctx.token, {
                method: "POST",
                body: JSON.stringify({ attendeeId: attendee.id, dayId: activeDayId }),
            });
            setResults((prev) => prev.map((r) => (r.id === attendee.id ? { ...r, checkedInAt: data.checkedInAt } : r)));
            if (!data.alreadyCheckedIn) {
                showToast(`${attendee.fullName} checked in.`, "success");
                loadAnalytics();
            }
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not confirm check-in.", "error");
        }
    };

    const submitWalkIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!walkInForm.fullName) return;
        try {
            const customFields = Object.fromEntries(ctx.walkinFields.map((f) => [f, walkInForm[f] || ""]));
            await eventFetch("/api/events/register", ctx.token, {
                method: "POST",
                body: JSON.stringify({
                    dayId: activeDayId,
                    fullName: walkInForm.fullName,
                    email: walkInForm.email,
                    phone: walkInForm.phone,
                    customFields,
                }),
            });
            showToast(`${walkInForm.fullName} registered and checked in.`, "success");
            setWalkInForm({ fullName: "", email: "", phone: "" });
            setShowWalkIn(false);
            loadAnalytics();
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not register walk-in.", "error");
        }
    };

    const requestExport = async () => {
        try {
            await eventFetch("/api/events/export-request", ctx.token, { method: "POST" });
            showToast("Request sent — an admin needs to approve it before you can download anything.", "info");
            loadExportStatus();
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not request export.", "error");
        }
    };

    const uploadCsv = async (file: File) => {
        setIsUploadingCsv(true);
        try {
            const csvContent = await file.text();
            const data = await eventFetch("/api/events/import-request", ctx.token, {
                method: "POST",
                body: JSON.stringify({ csvContent, fileName: file.name }),
            });
            const skippedNote = data.preview?.skipped ? ` (${data.preview.skipped} row${data.preview.skipped === 1 ? "" : "s"} skipped — missing a name)` : "";
            showToast(`Uploaded ${data.preview?.usable ?? ""} attendees${skippedNote} — an admin will review it before it's added.`, "info");
            loadImportStatus();
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not upload that file.", "error");
        } finally {
            setIsUploadingCsv(false);
        }
    };

    const downloadSampleCsv = async () => {
        try {
            const data = await eventFetch("/api/events/import-template", ctx.token);
            const blob = new Blob([data.csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = data.fileName || "guest-list-template.csv";
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not get the sample file.", "error");
        }
    };

    const activeDayLabel = useMemo(() => ctx.days.find((d) => d.id === activeDayId)?.label, [ctx.days, activeDayId]);
    const maxHourly = Math.max(1, ...analytics.hourly.map((h) => h.count));

    const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = isFull
        ? [
            { id: "checkin", label: "Check-in", icon: ClipboardCheck },
            { id: "analytics", label: "Analytics", icon: LayoutDashboard },
            { id: "manage", label: "Manage Event", icon: Settings2 },
        ]
        : [{ id: "analytics", label: "Analytics", icon: LayoutDashboard }];

    return (
        <div className="space-y-8">
            {/* Tab bar */}
            <div className="flex gap-1 border-b border-border">
                {tabs.map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${tab === t.id
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            <Icon size={14} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Day selector — relevant to Analytics and Check-in, not Manage Event */}
            {tab !== "manage" && (
                <div className="flex flex-wrap gap-2">
                    {ctx.days.map((day) => (
                        <button
                            key={day.id}
                            onClick={() => setActiveDayId(day.id)}
                            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-colors ${activeDayId === day.id
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {day.label}
                        </button>
                    ))}
                </div>
            )}

            {tab === "analytics" && (
                <div className="space-y-8">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="border border-border p-6 bg-card">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Invited</p>
                            <p className="text-3xl font-light tracking-tight">{analytics.totalGuests}</p>
                        </div>
                        <div className="border border-border p-6 bg-card">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                Confirmed — {activeDayLabel}
                            </p>
                            <p className="text-3xl font-light tracking-tight">{analytics.checkedIn}</p>
                        </div>
                        <div className="border border-border p-6 bg-card">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">New Registrations</p>
                            <p className="text-3xl font-light tracking-tight">{analytics.newRegistrations}</p>
                        </div>
                        <div className="border border-border p-6 bg-card">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Check-in Rate</p>
                            <p className="text-3xl font-light tracking-tight">{analytics.checkInRate}%</p>
                        </div>
                        <div className="border border-border p-6 bg-card">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">No-Shows (so far)</p>
                            <p className="text-3xl font-light tracking-tight">{analytics.noShows}</p>
                        </div>
                    </div>

                    {/* Hourly check-in curve */}
                    <div className="border border-border bg-card p-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">
                            Check-ins by hour — {activeDayLabel}
                        </p>
                        {analytics.hourly.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No check-ins yet today.</p>
                        ) : (
                            <div className="space-y-2.5">
                                {analytics.hourly.map((h) => (
                                    <div key={h.hour} className="flex items-center gap-3">
                                        <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">{h.hour}</span>
                                        <div className="flex-1 h-5 bg-secondary relative">
                                            <div
                                                className="h-full bg-primary"
                                                style={{ width: `${(h.count / maxHourly) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold w-6 text-right shrink-0">{h.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cross-day rollup */}
                    {analytics.crossDay && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="border border-border p-6 bg-card flex items-center gap-4">
                                <div className="w-11 h-11 bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <Users size={18} />
                                </div>
                                <div>
                                    <p className="text-2xl font-light tracking-tight">{analytics.crossDay.uniqueAttendees}</p>
                                    <p className="text-xs text-muted-foreground">Unique guests across all {ctx.days.length} days</p>
                                </div>
                            </div>
                            <div className="border border-border p-6 bg-card flex items-center gap-4">
                                <div className="w-11 h-11 bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <Repeat size={18} />
                                </div>
                                <div>
                                    <p className="text-2xl font-light tracking-tight">{analytics.crossDay.totalCheckins}</p>
                                    <p className="text-xs text-muted-foreground">Total check-ins (repeat visits included)</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isFull && (
                        <div className="border border-border p-6 bg-card text-sm text-muted-foreground flex items-center gap-3">
                            <UserX size={16} className="shrink-0" />
                            You can see the numbers, but this login can't check people in or request the guest list.
                        </div>
                    )}
                </div>
            )}

            {tab === "checkin" && isFull && (
                <div className="space-y-8">
                    <div className="border border-border bg-card">
                        <div className="p-6 border-b border-border flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search by name, email, or phone…"
                                    className="w-full pl-10 pr-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                />
                            </div>
                            <button
                                onClick={() => setShowWalkIn(true)}
                                className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-border text-xs font-bold uppercase tracking-widest hover:bg-muted transition-colors whitespace-nowrap"
                            >
                                <UserPlus size={14} /> Register Walk-in
                            </button>
                        </div>

                        <div className="divide-y divide-border">
                            {query.trim() === "" && (
                                <p className="p-6 text-sm text-muted-foreground">Start typing to find a guest.</p>
                            )}
                            {query.trim() !== "" && !isSearching && results.length === 0 && (
                                <p className="p-6 text-sm text-muted-foreground">No matches. Try Register Walk-in instead.</p>
                            )}
                            {results.map((attendee) => {
                                const done = !!attendee.checkedInAt;
                                return (
                                    <div key={attendee.id} className="p-5 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">{attendee.fullName}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {attendee.email} · {attendee.phone}
                                            </p>
                                        </div>
                                        {done ? (
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 whitespace-nowrap">
                                                <CheckCircle2 size={14} />
                                                Checked in {new Date(attendee.checkedInAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => confirmCheckIn(attendee)}
                                                className="px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all whitespace-nowrap"
                                            >
                                                Confirm
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {tab === "manage" && isFull && (
                <div className="space-y-8">
                    {/* Export */}
                    <div className="border border-border p-6 bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium mb-1">Guest list export</p>
                            <p className="text-xs text-muted-foreground max-w-md">
                                Only a Cortdevs admin can approve a download. Clicking below just sends a
                                request — it doesn't hand you the file.
                            </p>
                            {latestExport && (
                                <p className="text-xs mt-2 flex items-center gap-1.5">
                                    <Clock size={12} className="text-muted-foreground" />
                                    Last request:{" "}
                                    <span
                                        className={
                                            latestExport.status === "approved"
                                                ? "text-emerald-600 font-semibold"
                                                : latestExport.status === "denied"
                                                    ? "text-destructive font-semibold"
                                                    : "text-amber-600 font-semibold"
                                        }
                                    >
                                        {latestExport.status}
                                    </span>
                                    {latestExport.status === "approved" && latestExport.fileUrl && (
                                        <a href={latestExport.fileUrl} className="ml-2 text-primary font-semibold underline" target="_blank" rel="noreferrer">
                                            Download
                                        </a>
                                    )}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={requestExport}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-xs font-bold uppercase tracking-widest hover:bg-muted transition-colors whitespace-nowrap"
                        >
                            <FileDown size={14} /> Request Export
                        </button>
                    </div>

                    {/* Guest list upload */}
                    <div className="border border-border p-6 bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium mb-1">Upload a guest list</p>
                            <p className="text-xs text-muted-foreground max-w-md">
                                Upload a CSV of pre-registered guests. An admin reviews it before anyone's added —
                                use the sample file to get the format right first.
                            </p>
                            {latestImport && (
                                <p className="text-xs mt-2 flex items-center gap-1.5">
                                    <Clock size={12} className="text-muted-foreground" />
                                    {latestImport.file_name} ({latestImport.row_count} rows) —{" "}
                                    <span
                                        className={
                                            latestImport.status === "approved"
                                                ? "text-emerald-600 font-semibold"
                                                : latestImport.status === "denied"
                                                    ? "text-destructive font-semibold"
                                                    : "text-amber-600 font-semibold"
                                        }
                                    >
                                        {latestImport.status}
                                    </span>
                                    {latestImport.status === "approved" && typeof latestImport.imported_count === "number" && (
                                        <span className="text-muted-foreground"> · {latestImport.imported_count} added{!!latestImport.skipped_count && `, ${latestImport.skipped_count} skipped`}</span>
                                    )}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={downloadSampleCsv}
                                className="inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                            >
                                <Download size={14} /> Sample CSV
                            </button>
                            <label className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border text-xs font-bold uppercase tracking-widest hover:bg-muted transition-colors whitespace-nowrap cursor-pointer">
                                {isUploadingCsv ? <RefreshCw size={14} className="animate-spin" /> : <FileUp size={14} />}
                                {isUploadingCsv ? "Uploading…" : "Upload CSV"}
                                <input
                                    type="file"
                                    accept=".csv,text/csv"
                                    disabled={isUploadingCsv}
                                    className="hidden"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCsv(f); e.target.value = ""; }}
                                />
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Walk-in modal */}
            {showWalkIn && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
                    <div className="w-full max-w-md bg-card border border-border p-8 relative">
                        <button
                            onClick={() => setShowWalkIn(false)}
                            className="absolute top-6 right-6 text-muted-foreground hover:text-foreground"
                        >
                            <X size={18} />
                        </button>
                        <h3 className="text-xl font-medium mb-1">Register Walk-in</h3>
                        <p className="text-xs text-muted-foreground mb-6">
                            Immediately checked in for {activeDayLabel}.
                        </p>
                        <form onSubmit={submitWalkIn} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Full Name
                                </label>
                                <input
                                    required
                                    value={walkInForm.fullName}
                                    onChange={(e) => setWalkInForm((p) => ({ ...p, fullName: e.target.value }))}
                                    className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={walkInForm.email}
                                        onChange={(e) => setWalkInForm((p) => ({ ...p, email: e.target.value }))}
                                        className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Phone
                                    </label>
                                    <input
                                        value={walkInForm.phone}
                                        onChange={(e) => setWalkInForm((p) => ({ ...p, phone: e.target.value }))}
                                        className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                    />
                                </div>
                            </div>
                            {ctx.walkinFields.map((field) => (
                                <div key={field} className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        {field}
                                    </label>
                                    <input
                                        value={walkInForm[field] || ""}
                                        onChange={(e) => setWalkInForm((p) => ({ ...p, [field]: e.target.value }))}
                                        className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                    />
                                </div>
                            ))}
                            <button
                                type="submit"
                                className="w-full py-3.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                            >
                                Register &amp; Check In
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
