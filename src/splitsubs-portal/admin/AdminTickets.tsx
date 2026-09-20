import { useEffect, useState } from "react";
import { RefreshCw, Send } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";

function TicketThread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
    const { showToast } = useToast();
    const [ticket, setTicket] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [reply, setReply] = useState("");
    const [isSending, setIsSending] = useState(false);

    const load = () => ssFetch(`/api/admin/splitsubs/tickets?id=${ticketId}`).then((d) => { setTicket(d.ticket); setMessages(d.messages || []); }).catch(() => { });
    useEffect(() => { load(); }, [ticketId]);

    const send = async (status?: string) => {
        setIsSending(true);
        try {
            await ssFetch("/api/admin/splitsubs/tickets", { method: "PATCH", body: JSON.stringify({ id: ticketId, reply: reply || undefined, status }) });
            setReply("");
            load();
        } catch (err: any) {
            showToast(err.message || "Could not update ticket.", "error");
        } finally {
            setIsSending(false);
        }
    };

    if (!ticket) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>;

    return (
        <div className="space-y-6">
            <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">← Back to tickets</button>
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-light tracking-tight">{ticket.subject}</h2>
                    <p className="text-xs text-muted-foreground">{ticket.userEmail} · {ticket.priority} · {ticket.status}</p>
                </div>
                <select value={ticket.status} onChange={(e) => send(e.target.value)} className="px-3 py-2 bg-background border border-border text-xs outline-none">
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                </select>
            </div>
            <div className="space-y-3">
                {messages.map((m) => (
                    <div key={m.id} className={`p-4 text-sm max-w-lg ${m.sender_type === "admin" ? "bg-primary/10 ml-auto" : "bg-secondary"}`}>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">{m.sender_type === "admin" ? "Support" : "User"}</p>
                        {m.message}
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} className="flex-1 px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm resize-none" placeholder="Reply..." />
                <button onClick={() => send()} disabled={isSending || !reply.trim()} className="px-4 bg-primary text-primary-foreground disabled:opacity-50"><Send size={16} /></button>
            </div>
        </div>
    );
}

export function AdminTickets() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selected, setSelected] = useState<string | null>(null);

    const load = () => ssFetch("/api/admin/splitsubs/tickets").then((d) => setTickets(d.tickets || [])).catch(() => { }).finally(() => setIsLoading(false));
    useEffect(() => { load(); }, []);

    if (selected) return <TicketThread ticketId={selected} onBack={() => { setSelected(null); load(); }} />;

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Support Tickets</h1>
                <p className="text-sm text-muted-foreground">Sorted by priority, then most recently updated.</p>
            </div>
            {isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {tickets.map((t) => (
                        <button key={t.id} onClick={() => setSelected(t.id)} className="w-full text-left px-5 py-4 hover:bg-secondary/50 transition-colors flex items-center justify-between">
                            <div>
                                <p className="font-medium text-sm">{t.subject}</p>
                                <p className="text-xs text-muted-foreground">{t.category.replace(/_/g, " ")}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-secondary">{t.priority}</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-secondary">{t.status}</span>
                            </div>
                        </button>
                    ))}
                    {tickets.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">No tickets.</p>}
                </div>
            )}
        </div>
    );
}
