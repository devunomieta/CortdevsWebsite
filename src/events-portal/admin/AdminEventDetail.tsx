import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import {
    ArrowLeft,
    Plus,
    X,
    Mail,
    RotateCw,
    Ban,
    CheckCircle2,
    FileDown,
    Trash2,
    ShieldCheck,
    Eye,
    RefreshCw,
} from "lucide-react";
import { useToast } from "../../app/components/Toast";
import { adminFetch, ApiError } from "../lib/api";

interface EventDetail {
    id: string;
    title: string;
    slug: string;
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

export function AdminEventDetail() {
    const { eventId } = useParams();
    const { showToast } = useToast();
    const [event, setEvent] = useState<EventDetail | null>(null);
    const [days, setDays] = useState<EventDay[]>([]);
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [exportRequests, setExportRequests] = useState<ExportRequestRow[]>([]);
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
    const [showIssue, setShowIssue] = useState(false);
    const [issueForm, setIssueForm] = useState({ label: "", email: "", role: "full" as "full" | "view_only", dayId: "" });

    const loadAll = () => {
        if (!eventId) return;
        adminFetch(`/api/admin/events?id=${eventId}`).then((d) => { setEvent(d.event); setDays(d.days); }).catch(() => { });
        adminFetch(`/api/admin/events/credentials?eventId=${eventId}`).then((d) => setCredentials(d.credentials)).catch(() => { });
        adminFetch(`/api/admin/events/export-requests?eventId=${eventId}`).then((d) => setExportRequests(d.requests)).catch(() => { });
        adminFetch(`/api/admin/events/audit-log?eventId=${eventId}`).then((d) => setAuditLog(d.entries)).catch(() => { });
    };

    useEffect(loadAll, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleCredential = async (cred: Credential) => {
        try {
            await adminFetch("/api/admin/events/credentials", {
                method: "POST",
                body: JSON.stringify({ action: cred.is_active ? "revoke" : "enable", credentialId: cred.id }),
            });
            setCredentials((prev) => prev.map((c) => (c.id === cred.id ? { ...c, is_active: !c.is_active } : c)));
            showToast(cred.is_active ? `${cred.label}'s access revoked.` : `${cred.label}'s access re-enabled.`, cred.is_active ? "warning" : "success");
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not update credential.", "error");
        }
    };

    const rotatePassword = async (cred: Credential) => {
        try {
            const data = await adminFetch("/api/admin/events/credentials", { method: "POST", body: JSON.stringify({ action: "rotate", credentialId: cred.id }) });
            showToast(`New password for ${cred.label}: ${data.password} (copy it now — it won't be shown again)`, "success");
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not rotate password.", "error");
        }
    };

    const sendCredentialEmail = async (cred: Credential) => {
        try {
            await adminFetch("/api/admin/events/credentials-email", { method: "POST", body: JSON.stringify({ credentialId: cred.id }) });
            showToast(`Login sent to ${cred.email}.`, "success");
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
            showToast(err instanceof ApiError ? err.message : "Could not decide export request.", "error");
        }
    };

    const purgeAttendeeData = async () => {
        if (!eventId) return;
        try {
            await adminFetch("/api/admin/events/purge", { method: "POST", body: JSON.stringify({ eventId }) });
            showToast("Attendee contact data purged for this event. Historical counts are unaffected.", "warning");
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not purge attendee data.", "error");
        }
    };

    const issueCredential = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventId) return;
        try {
            const data = await adminFetch("/api/admin/events/credentials", {
                method: "POST",
                body: JSON.stringify({ action: "issue", eventId, ...issueForm, dayId: issueForm.dayId || null }),
            });
            showToast(`Credential issued for ${issueForm.label}. Password: ${data.password} (copy it now — it won't be shown again)`, "success");
            setShowIssue(false);
            setIssueForm({ label: "", email: "", role: "full", dayId: "" });
            loadAll();
        } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Could not issue credential.", "error");
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

    return (
        <div className="space-y-10">
            <div>
                <Link to="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground mb-4">
                    <ArrowLeft size={14} /> All Events
                </Link>
                <h1 className="text-2xl font-light tracking-tight">{event.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">/e/{event.slug} · Event ID {eventId}</p>
            </div>

            {/* Credentials */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        Credentials ({credentials.length})
                    </h2>
                    <button
                        onClick={() => setShowIssue(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                    >
                        <Plus size={14} /> Issue Credential
                    </button>
                </div>

                <div className="border border-border bg-card divide-y divide-border">
                    {credentials.length === 0 && <p className="p-5 text-sm text-muted-foreground">No credentials issued yet.</p>}
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
                                <button onClick={() => sendCredentialEmail(cred)} title="Email login to event owner" className="p-2 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                    <Mail size={14} />
                                </button>
                                <button onClick={() => rotatePassword(cred)} title="Rotate password" className="p-2 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
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
                    Export Requests {pendingExports.length > 0 && <span className="text-destructive">({pendingExports.length} pending)</span>}
                </h2>
                <div className="border border-border bg-card divide-y divide-border">
                    {exportRequests.length === 0 && <p className="p-5 text-sm text-muted-foreground">No export requests yet.</p>}
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

            {/* Retention */}
            <section className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Data Retention</h2>
                <div className="border border-border bg-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium mb-1">7-day post-event window</p>
                        <p className="text-xs text-muted-foreground max-w-md">
                            Once this event's last day ends, both the admin and event owner get daily reminders to
                            export. Unexported attendee contact data is deleted automatically on day 7. Historical
                            counts are kept either way.
                        </p>
                    </div>
                    <button
                        onClick={purgeAttendeeData}
                        className="inline-flex items-center gap-2 px-5 py-3 border border-destructive/30 text-destructive text-xs font-bold uppercase tracking-widest hover:bg-destructive/10 transition-colors whitespace-nowrap"
                    >
                        <Trash2 size={14} /> Purge Now
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

            {/* Issue credential modal */}
            {showIssue && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
                    <div className="w-full max-w-md bg-card border border-border p-8 relative">
                        <button onClick={() => setShowIssue(false)} className="absolute top-6 right-6 text-muted-foreground hover:text-foreground">
                            <X size={18} />
                        </button>
                        <h3 className="text-xl font-medium mb-1">Issue Credential</h3>
                        <p className="text-xs text-muted-foreground mb-6">
                            One login per staffer or desk — this is what makes check-ins attributable.
                        </p>
                        <form onSubmit={issueCredential} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Label</label>
                                <input
                                    required
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
                                Issue Credential
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
