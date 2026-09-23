import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import {
    ArrowLeft,
    Plus,
    X,
    Mail,
    RotateCw,
    Ban,
    CheckCircle2,
    FileDown,
    FileUp,
    ExternalLink,
    Trash2,
    ShieldCheck,
    Eye,
    KeyRound,
    RefreshCw,
    Image as ImageIcon,
} from "lucide-react";
import { useToast } from "../../app/components/Toast";
import { adminFetch, ApiError } from "../lib/api";
import { supabase } from "../../lib/supabase";
import { subscribeToChannel } from "../lib/realtime";
import { isValidEmail, isValidFieldName, LIMITS } from "../lib/validation";

interface EventDetail {
    id: string;
    title: string;
    slug: string;
    flier_url: string | null;
    walkin_fields: string[];
}
interface EventDay { id: string; date: string; label: string; }
interface Credential {
    id: string;
    label: string;
    email: string;
    role: "full" | "view_only";
    event_day_id: string | null;
    is_active: boolean;
}
interface ExportRequestRow {
    id: string;
    status: "pending" | "approved" | "denied";
    requested_at: string;
    decided_at?: string;
}
interface AuditEntry { id: string; actor_label: string; action: string; created_at: string; }
interface ImportRequestRow {
    id: string;
    file_name: string;
    row_count: number;
    status: "pending" | "approved" | "denied";
    uploaded_at: string;
    decided_at?: string;
    imported_count?: number | null;
    skipped_count?: number | null;
    reviewUrl: string | null;
}

export function AdminEventDetail() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [event, setEvent] = useState<EventDetail | null>(null);
    const [days, setDays] = useState<EventDay[]>([]);
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [exportRequests, setExportRequests] = useState<ExportRequestRow[]>([]);
    const [importRequests, setImportRequests] = useState<ImportRequestRow[]>([]);
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
    const [showIssue, setShowIssue] = useState(false);
    const [issueForm, setIssueForm] = useState({ label: "", email: "", role: "full" as "full" | "view_only", dayId: "" });
    const [isUploadingFlier, setIsUploadingFlier] = useState(false);
    const [isProcessingImport, setIsProcessingImport] = useState(false);
    const [newFieldName, setNewFieldName] = useState("");
    const [isSavingFields, setIsSavingFields] = useState(false);

    const loadAll = () => {
        if (!eventId) return;
        adminFetch(`/api/admin/events?id=${eventId}`).then((d) => { setEvent(d.event); setDays(d.days); }).catch(() => { });
        adminFetch(`/api/admin/events/credentials?eventId=${eventId}`).then((d) => setCredentials(d.credentials)).catch(() => { });
        adminFetch(`/api/admin/events/export-requests?eventId=${eventId}`).then((d) => setExportRequests(d.requests)).catch(() => { });
        adminFetch(`/api/admin/events/imports?eventId=${eventId}`).then((d) => setImportRequests(d.requests)).catch(() => { });
        adminFetch(`/api/admin/events/audit-log?eventId=${eventId}`).then((d) => setAuditLog(d.entries)).catch(() => { });
    };

    useEffect(loadAll, [eventId]);  

    // Live: check-in activity and decisions made from this same page.
    useEffect(() => {
        if (!eventId) return;
        return subscribeToChannel(`event-${eventId}`, "update", loadAll);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId]);

    // Live: a new export/import request or retention reminder from any event
    // — cheap enough to just reload this page's lists when one comes in.
    useEffect(() => subscribeToChannel("admin-notifications", "update", loadAll), []); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleCredential = async (cred: Credential) => {
        try {
            await adminFetch("/api/admin/events/credentials", {
                method: "POST",
                body: JSON.stringify({ action: cred.is_active ? "revoke" : "enable", credentialId: cred.id }),
            });
            setCredentials((prev) => prev.map((c) => (c.id === cred.id ? { ...c, is_active: !c.is_active } : c)));
            showToast(cred.is_active ? `${cred.label}'s access revoked.` : `${cred.label}'s access re-enabled.`, cred.is_active ? "warning" : "success");
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not update this login.", "error");
        }
    };

    const viewPassword = async (cred: Credential) => {
        try {
            const data = await adminFetch("/api/admin/events/credentials", { method: "POST", body: JSON.stringify({ action: "reveal", credentialId: cred.id }) });
            showToast(`${cred.label}'s current password: ${data.password}`, "info");
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not look up this password.", "error");
        }
    };

    const rotatePassword = async (cred: Credential) => {
        if (!confirm(`This creates a new password for ${cred.label} and immediately stops the current one from working. Continue?`)) return;
        try {
            const data = await adminFetch("/api/admin/events/credentials", { method: "POST", body: JSON.stringify({ action: "rotate", credentialId: cred.id }) });
            showToast(`New password for ${cred.label}: ${data.password} (the old one no longer works)`, "success");
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not rotate password.", "error");
        }
    };

    const sendCredentialEmail = async (cred: Credential) => {
        try {
            await adminFetch("/api/admin/events/credentials-email", { method: "POST", body: JSON.stringify({ credentialId: cred.id, rotate: false }) });
            showToast(`Current login resent to ${cred.email} — unchanged.`, "success");
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not send login email.", "error");
        }
    };

    const decideExport = async (id: string, decision: "approved" | "denied") => {
        try {
            await adminFetch("/api/admin/events/export-requests", { method: "POST", body: JSON.stringify({ action: decision === "approved" ? "approve" : "deny", requestId: id }) });
            setExportRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: decision, decided_at: new Date().toISOString() } : r)));
            showToast(decision === "approved" ? "Export approved — a download link is now available to the requester." : "Export request denied.", decision === "approved" ? "success" : "info");
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not update this request.", "error");
        }
    };

    const decideImport = async (id: string, decision: "approved" | "denied") => {
        try {
            const data = await adminFetch("/api/admin/events/imports", { method: "POST", body: JSON.stringify({ action: decision === "approved" ? "approve" : "deny", requestId: id }) });
            showToast(
                decision === "approved" ? `Approved — ${data.imported} added${data.skipped ? `, ${data.skipped} skipped` : ""}.` : "Guest list upload denied.",
                decision === "approved" ? "success" : "info"
            );
            loadAll();
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not update this request.", "error");
        }
    };

    const replaceAndApproveImport = async (id: string, file: File) => {
        setIsProcessingImport(true);
        try {
            const csvContent = await file.text();
            const data = await adminFetch("/api/admin/events/imports", {
                method: "POST",
                body: JSON.stringify({ action: "replace-and-approve", requestId: id, csvContent, fileName: file.name }),
            });
            showToast(`Replaced and approved — ${data.imported} added${data.skipped ? `, ${data.skipped} skipped` : ""}.`, "success");
            loadAll();
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not process that file.", "error");
        } finally {
            setIsProcessingImport(false);
        }
    };

    const importNow = async (file: File) => {
        if (!eventId) return;
        setIsProcessingImport(true);
        try {
            const csvContent = await file.text();
            const data = await adminFetch("/api/admin/events/imports", {
                method: "POST",
                body: JSON.stringify({ action: "import-now", eventId, csvContent, fileName: file.name }),
            });
            showToast(`Imported ${data.imported} attendees${data.skipped ? `, ${data.skipped} skipped` : ""}.`, "success");
            loadAll();
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not import that file.", "error");
        } finally {
            setIsProcessingImport(false);
        }
    };

    const saveWalkinFields = async (fields: string[]) => {
        if (!eventId) return;
        setIsSavingFields(true);
        try {
            await adminFetch("/api/admin/events/update", { method: "POST", body: JSON.stringify({ id: eventId, walkinFields: fields }) });
            setEvent((prev) => (prev ? { ...prev, walkin_fields: fields } : prev));
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not update the custom fields.", "error");
        } finally {
            setIsSavingFields(false);
        }
    };

    const addCustomField = () => {
        const name = newFieldName.trim();
        if (!name || !event) return;
        if (!isValidFieldName(name)) {
            showToast("Field names can only use letters, numbers, spaces, and basic punctuation, up to 40 characters.", "error");
            return;
        }
        if (event.walkin_fields.some((f) => f.toLowerCase() === name.toLowerCase())) {
            showToast("That field already exists.", "error");
            return;
        }
        setNewFieldName("");
        saveWalkinFields([...event.walkin_fields, name]);
    };

    const removeCustomField = (name: string) => {
        if (!event) return;
        saveWalkinFields(event.walkin_fields.filter((f) => f !== name));
    };

    const uploadFlier = async (file: File) => {
        if (!eventId || !event) return;
        setIsUploadingFlier(true);
        try {
            const ext = file.name.split(".").pop();
            const path = `event-fliers/${event.slug}-${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage.from("assets").upload(path, file, { upsert: true });
            if (uploadError) throw new ApiError(uploadError.message);
            const flierUrl = supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;

            await adminFetch("/api/admin/events/update", { method: "POST", body: JSON.stringify({ id: eventId, flierUrl }) });
            setEvent((prev) => (prev ? { ...prev, flier_url: flierUrl } : prev));
            showToast("Flier updated.", "success");
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not upload flier.", "error");
        } finally {
            setIsUploadingFlier(false);
        }
    };

    const purgeAttendeeData = async () => {
        if (!eventId) return;
        try {
            await adminFetch("/api/admin/events/purge", { method: "POST", body: JSON.stringify({ eventId }) });
            showToast("Guest details deleted for this event. The attendance numbers are still there.", "warning");
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not purge attendee data.", "error");
        }
    };

    const clearEventData = async () => {
        if (!eventId || !event) return;
        const confirmed = confirm(
            `Are you sure you want to clear all data and access logins for "${event.title}"? This will reset all attendees, check-ins, import/export requests, and access logins to as if it's a brand new event. There's no undo.`
        );
        if (!confirmed) return;
        try {
            await adminFetch("/api/admin/events/clear-data", { method: "POST", body: JSON.stringify({ eventId }) });
            showToast("Event data and logins cleared. Reset to brand new event state.", "success");
            loadAll();
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not clear event data.", "error");
        }
    };

    const deleteEvent = async () => {
        if (!eventId || !event) return;
        const confirmed = confirm(
            `Permanently delete "${event.title}"? This also deletes every login, attendee, check-in, and upload for this event. There's no undo.`
        );
        if (!confirmed) return;
        try {
            await adminFetch(`/api/admin/events?id=${eventId}`, { method: "DELETE" });
            showToast(`"${event.title}" deleted.`, "warning");
            navigate("/admin");
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not delete this event.", "error");
        }
    };

    const issueCredential = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventId) return;
        if (!issueForm.label.trim()) {
            showToast("Label is required.", "error");
            return;
        }
        if (!isValidEmail(issueForm.email)) {
            showToast("That email address doesn't look valid.", "error");
            return;
        }
        try {
            const data = await adminFetch("/api/admin/events/credentials", {
                method: "POST",
                body: JSON.stringify({ action: "issue", eventId, ...issueForm, dayId: issueForm.dayId || null }),
            });
            showToast(`Login created for ${issueForm.label}. Password: ${data.password} (copy it now — it won't be shown again)`, "success");
            setShowIssue(false);
            setIssueForm({ label: "", email: "", role: "full", dayId: "" });
            loadAll();
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not create this login.", "error");
        }
    };

    if (!event) {
        return (
            <div className="flex items-center justify-center py-24">
                <RefreshCw className="animate-spin text-primary" size={22} />
            </div>
        );
    }

    const pendingExports = exportRequests.filter((r) => r.status === "pending");
    const pendingImports = importRequests.filter((r) => r.status === "pending");

    return (
        <div className="space-y-10">
            <div>
                <Link to="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground mb-4">
                    <ArrowLeft size={14} /> All Events
                </Link>
                <h1 className="text-2xl font-light tracking-tight">{event.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">/e/{event.slug} · Event ID {eventId}</p>
            </div>

            {/* Flier */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Event Flier</h2>
                <div className="border border-border bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-6">
                    {event.flier_url ? (
                        <img src={event.flier_url} alt={`${event.title} flier`} className="w-40 h-40 object-cover border border-border shrink-0" />
                    ) : (
                        <div className="w-40 h-40 border border-dashed border-border flex items-center justify-center text-muted-foreground shrink-0">
                            <ImageIcon size={24} />
                        </div>
                    )}
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground max-w-sm">
                            {event.flier_url ? "Replace the flier for this event." : "No flier uploaded yet."}
                        </p>
                        <label className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-xs font-bold uppercase tracking-widest hover:bg-muted transition-colors cursor-pointer w-fit">
                            {isUploadingFlier ? <RefreshCw size={13} className="animate-spin" /> : <ImageIcon size={13} />}
                            {isUploadingFlier ? "Uploading…" : event.flier_url ? "Replace Flier" : "Upload Flier"}
                            <input
                                type="file"
                                accept="image/*"
                                disabled={isUploadingFlier}
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFlier(f); }}
                            />
                        </label>
                    </div>
                </div>
            </section>

            {/* Custom walk-in fields */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Custom Walk-in Fields</h2>
                <div className="border border-border bg-card p-6 space-y-3">
                    <p className="text-xs text-muted-foreground max-w-md">
                        Beyond name, email, and phone — these appear on the walk-in form, in CSV imports/exports,
                        and get saved instantly. Changing them doesn't touch attendees already on file.
                    </p>
                    {event.walkin_fields.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {event.walkin_fields.map((field) => (
                                <span key={field} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-secondary text-xs font-medium">
                                    {field}
                                    <button onClick={() => removeCustomField(field)} disabled={isSavingFields} className="text-muted-foreground hover:text-destructive transition-colors">
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2 max-w-sm">
                        <input
                            maxLength={LIMITS.fieldName}
                            value={newFieldName}
                            onChange={(e) => setNewFieldName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomField(); } }}
                            placeholder="e.g. Company"
                            disabled={isSavingFields}
                            className="flex-1 px-4 py-2.5 bg-background border border-border outline-none focus:border-primary text-sm min-w-0"
                        />
                        <button onClick={addCustomField} disabled={isSavingFields} className="px-4 py-2.5 border border-border text-xs font-bold uppercase tracking-widest hover:bg-muted transition-colors shrink-0 disabled:opacity-50">
                            {isSavingFields ? <RefreshCw size={13} className="animate-spin" /> : "Add"}
                        </button>
                    </div>
                </div>
            </section>

            {/* Credentials */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        Logins ({credentials.length})
                    </h2>
                    <button
                        onClick={() => setShowIssue(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                    >
                        <Plus size={14} /> Add Login
                    </button>
                </div>

                <div className="border border-border bg-card divide-y divide-border">
                    {credentials.length === 0 && <p className="p-5 text-sm text-muted-foreground">No logins yet.</p>}
                    {credentials.map((cred) => (
                        <div key={cred.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    {cred.role === "full" ? <ShieldCheck size={14} className="text-muted-foreground" /> : <Eye size={14} className="text-muted-foreground" />}
                                    <p className="font-medium truncate">{cred.label}</p>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        {cred.role === "full" ? "Full" : "View-only"}
                                    </span>
                                    {!cred.is_active && (
                                        <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-destructive/10 text-destructive">
                                            Revoked
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                    {cred.email} · {cred.event_day_id ? days.find((d) => d.id === cred.event_day_id)?.label : "Whole event"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => viewPassword(cred)} title="View current password (doesn't change it)" className="p-2 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                    <KeyRound size={14} />
                                </button>
                                <button onClick={() => sendCredentialEmail(cred)} title="Resend current login by email (doesn't change it)" className="p-2 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                    <Mail size={14} />
                                </button>
                                <button onClick={() => rotatePassword(cred)} title="Rotate password — invalidates the current one" className="p-2 border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors">
                                    <RotateCw size={14} />
                                </button>
                                <button
                                    onClick={() => toggleCredential(cred)}
                                    title={cred.is_active ? "Revoke" : "Re-enable"}
                                    className={`p-2 border transition-colors ${cred.is_active
                                            ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                                            : "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                                        }`}
                                >
                                    {cred.is_active ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Export requests */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    Download Requests {pendingExports.length > 0 && <span className="text-destructive">({pendingExports.length} pending)</span>}
                </h2>
                <div className="border border-border bg-card divide-y divide-border">
                    {exportRequests.length === 0 && <p className="p-5 text-sm text-muted-foreground">No requests yet.</p>}
                    {exportRequests.map((req) => (
                        <div key={req.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium">Request {req.id.slice(0, 8)}</p>
                                <p className="text-xs text-muted-foreground">
                                    {new Date(req.requested_at).toLocaleString()}
                                    {req.decided_at && ` · decided ${new Date(req.decided_at).toLocaleString()}`}
                                </p>
                            </div>
                            {req.status === "pending" ? (
                                <div className="flex gap-2 shrink-0">
                                    <button onClick={() => decideExport(req.id, "denied")} className="px-4 py-2 text-xs font-bold uppercase tracking-widest border border-border hover:bg-muted transition-colors">
                                        Deny
                                    </button>
                                    <button onClick={() => decideExport(req.id, "approved")} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all">
                                        <FileDown size={13} /> Approve
                                    </button>
                                </div>
                            ) : (
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 shrink-0 ${req.status === "approved" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
                                    {req.status}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Guest list uploads */}
            <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        Guest List Uploads {pendingImports.length > 0 && <span className="text-destructive">({pendingImports.length} pending)</span>}
                    </h2>
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 border border-border text-xs font-bold uppercase tracking-widest hover:bg-muted transition-colors cursor-pointer whitespace-nowrap">
                        {isProcessingImport ? <RefreshCw size={13} className="animate-spin" /> : <FileUp size={13} />}
                        Import Directly
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            disabled={isProcessingImport}
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) importNow(f); e.target.value = ""; }}
                        />
                    </label>
                </div>
                <div className="border border-border bg-card divide-y divide-border">
                    {importRequests.length === 0 && <p className="p-5 text-sm text-muted-foreground">No uploads yet.</p>}
                    {importRequests.map((req) => (
                        <div key={req.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium truncate">{req.file_name}</p>
                                    {req.reviewUrl && (
                                        <a href={req.reviewUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Review the raw file">
                                            <ExternalLink size={12} />
                                        </a>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {req.row_count} rows · {new Date(req.uploaded_at).toLocaleString()}
                                    {req.status === "approved" && typeof req.imported_count === "number" && ` · ${req.imported_count} added${req.skipped_count ? `, ${req.skipped_count} skipped` : ""}`}
                                </p>
                            </div>
                            {req.status === "pending" ? (
                                <div className="flex flex-wrap gap-2 shrink-0">
                                    <button onClick={() => decideImport(req.id, "denied")} className="px-4 py-2 text-xs font-bold uppercase tracking-widest border border-border hover:bg-muted transition-colors">
                                        Deny
                                    </button>
                                    <label className="inline-flex items-center gap-2 px-4 py-2 border border-border text-xs font-bold uppercase tracking-widest hover:bg-muted transition-colors cursor-pointer">
                                        Reupload &amp; Approve
                                        <input
                                            type="file"
                                            accept=".csv,text/csv"
                                            disabled={isProcessingImport}
                                            className="hidden"
                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceAndApproveImport(req.id, f); e.target.value = ""; }}
                                        />
                                    </label>
                                    <button onClick={() => decideImport(req.id, "approved")} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all">
                                        <CheckCircle2 size={13} /> Approve
                                    </button>
                                </div>
                            ) : (
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 shrink-0 ${req.status === "approved" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
                                    {req.status}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Retention */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Guest Data</h2>
                <div className="border border-border bg-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium mb-1">Deletes itself after 7 days</p>
                        <p className="text-xs text-muted-foreground max-w-md">
                            Once this event's last day ends, you and the event owner get daily reminders to
                            save the guest list. Anything not saved is deleted automatically on day 7. The
                            attendance numbers stay either way.
                        </p>
                    </div>
                    <button
                        onClick={purgeAttendeeData}
                        className="inline-flex items-center gap-2 px-5 py-3 border border-destructive/30 text-destructive text-xs font-bold uppercase tracking-widest hover:bg-destructive/10 transition-colors whitespace-nowrap"
                    >
                        <Trash2 size={14} /> Delete Now
                    </button>
                </div>
            </section>

            {/* Audit log */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Activity Log</h2>
                <div className="border border-border bg-card divide-y divide-border">
                    {auditLog.length === 0 && <p className="p-5 text-sm text-muted-foreground">No activity yet.</p>}
                    {auditLog.map((entry) => (
                        <div key={entry.id} className="p-4 flex items-center justify-between gap-4 text-sm">
                            <p>
                                <span className="font-medium">{entry.actor_label}</span>{" "}
                                <span className="text-muted-foreground">{entry.action}</span>
                            </p>
                            <p className="text-xs text-muted-foreground shrink-0">{new Date(entry.created_at).toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Danger zone */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-destructive">Danger Zone</h2>
                <div className="border border-destructive/30 bg-destructive/5 divide-y divide-destructive/20">
                    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium mb-1">Clear Event Data &amp; Logins</p>
                            <p className="text-xs text-muted-foreground max-w-md">
                                Resets this event back to a fresh state by wiping all attendees, check-ins, import/export requests,
                                and access logins. The event configuration (title, days, and custom fields) is kept.
                            </p>
                        </div>
                        <button
                            onClick={clearEventData}
                            className="inline-flex items-center gap-2 px-5 py-3 border border-destructive/40 text-destructive text-xs font-bold uppercase tracking-widest hover:bg-destructive/15 transition-all whitespace-nowrap shrink-0"
                        >
                            <RotateCw size={14} /> Clear Data
                        </button>
                    </div>
                    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium mb-1">Delete this event</p>
                            <p className="text-xs text-muted-foreground max-w-md">
                                Permanently removes the event and everything under it — logins, attendees, check-ins, and uploads.
                                There's no undo.
                            </p>
                        </div>
                        <button
                            onClick={deleteEvent}
                            className="inline-flex items-center gap-2 px-5 py-3 bg-destructive text-destructive-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all whitespace-nowrap shrink-0"
                        >
                            <Trash2 size={14} /> Delete Event
                        </button>
                    </div>
                </div>
            </section>

            {/* Issue credential modal */}
            {showIssue && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
                    <div className="w-full max-w-md bg-card border border-border p-8 relative">
                        <button onClick={() => setShowIssue(false)} className="absolute top-6 right-6 text-muted-foreground hover:text-foreground">
                            <X size={18} />
                        </button>
                        <h3 className="text-xl font-medium mb-1">Add a Login</h3>
                        <p className="text-xs text-muted-foreground mb-6">
                            Give each person or desk their own login. That way you always know who checked someone in.
                        </p>
                        <form onSubmit={issueCredential} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Label</label>
                                <input
                                    required
                                    maxLength={LIMITS.label}
                                    value={issueForm.label}
                                    onChange={(e) => setIssueForm((p) => ({ ...p, label: e.target.value }))}
                                    placeholder="e.g. Front Desk, Jane — VIP Desk"
                                    className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Login Email</label>
                                <input
                                    required
                                    type="email"
                                    maxLength={200}
                                    value={issueForm.email}
                                    onChange={(e) => setIssueForm((p) => ({ ...p, email: e.target.value }))}
                                    className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role</label>
                                    <select
                                        value={issueForm.role}
                                        onChange={(e) => setIssueForm((p) => ({ ...p, role: e.target.value as "full" | "view_only" }))}
                                        className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                    >
                                        <option value="full">Full access</option>
                                        <option value="view_only">View-only</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Valid For</label>
                                    <select
                                        value={issueForm.dayId}
                                        onChange={(e) => setIssueForm((p) => ({ ...p, dayId: e.target.value }))}
                                        className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                    >
                                        <option value="">Whole event</option>
                                        {days.map((d) => (
                                            <option key={d.id} value={d.id}>{d.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="w-full py-3.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all">
                                Add Login
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
