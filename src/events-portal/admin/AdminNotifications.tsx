import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Clock, FileDown, CheckCheck, RefreshCw } from "lucide-react";
import { adminFetch, ApiError } from "../lib/api";
import { useToast } from "../../app/components/Toast";

interface Notification {
    id: string;
    kind: "retention" | "export";
    title: string;
    detail: string;
    created_at: string;
    read: boolean;
    event_id: string;
}

export function AdminNotifications() {
    const { showToast } = useToast();
    const [notifications, setNotifications] = useState<Notification[] | null>(null);

    const load = () => {
        adminFetch("/api/admin/events/notifications")
            .then((data) => setNotifications(data.notifications))
            .catch((err) => showToast(err instanceof ApiError ? err.message : "Could not load notifications.", "error"));
    };

    useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

    const unreadCount = notifications?.filter((n) => !n.read).length || 0;

    const markAllRead = async () => {
        await adminFetch("/api/admin/events/notifications", { method: "POST", body: JSON.stringify({ action: "mark-all-read" }) });
        setNotifications((prev) => prev!.map((n) => ({ ...n, read: true })));
    };

    const markRead = async (id: string) => {
        await adminFetch("/api/admin/events/notifications", { method: "POST", body: JSON.stringify({ action: "mark-read", id }) });
        setNotifications((prev) => prev!.map((n) => (n.id === id ? { ...n, read: true } : n)));
    };

    if (notifications === null) {
        return (
            <div className="flex items-center justify-center py-24">
                <RefreshCw className="animate-spin text-primary" size={22} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-light tracking-tight">Notifications</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {unreadCount > 0 ? `${unreadCount} unread` : "You're caught up"} — download requests
                        and reminders about events that ended show up here.
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button onClick={markAllRead} className="inline-flex items-center gap-2 px-4 py-2.5 border border-border text-xs font-bold uppercase tracking-widest hover:bg-muted transition-colors">
                        <CheckCheck size={14} /> Mark All Read
                    </button>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                    Nothing here yet.
                </div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {notifications.map((n) => (
                        <div key={n.id} className={`p-5 flex items-start gap-4 ${!n.read ? "bg-primary/[0.03]" : ""}`}>
                            <div className={`w-9 h-9 flex items-center justify-center shrink-0 ${n.kind === "export" ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"}`}>
                                {n.kind === "export" ? <FileDown size={16} /> : <Clock size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">{n.title}</p>
                                    {!n.read && <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{n.detail}</p>
                                <div className="flex items-center gap-4 mt-3">
                                    <Link to={`/admin/events/${n.event_id}`} className="text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-70">
                                        View Event →
                                    </Link>
                                    {!n.read && (
                                        <button onClick={() => markRead(n.id)} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
                                            Mark Read
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground shrink-0">{new Date(n.created_at).toLocaleDateString()}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
