import { useEffect, useState } from "react";
import { RefreshCw, Send } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";
import { SEO } from "../components/SEO";

const STATUS_TABS = ["all", "open", "pending", "resolved", "closed"];

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
    const [selected, setSelected] = useState<string | null>(null);
    const [statusTab, setStatusTab] = useState("all");
    const list = usePaginatedList<any>("/api/admin/splitsubs/tickets", "tickets", {
        defaultSort: "priority",
        extraParams: statusTab === "all" ? {} : { status: statusTab },
    });

    if (selected) return <TicketThread ticketId={selected} onBack={() => { setSelected(null); list.reload(); }} />;

    return (
        <div className="max-w-4xl space-y-6">
            <SEO title="Support Tickets" description="Support ticket queue." path="/admin/tickets" noindex />
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Support Tickets</h1>
                <p className="text-sm text-muted-foreground">Sorted by priority, then most recently updated.</p>
            </div>

            <div className="flex flex-wrap gap-2">
                {STATUS_TABS.map((t) => (
                    <button key={t} onClick={() => { setStatusTab(t); list.setPage(1); }} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border ${statusTab === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        {t}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search by subject..." />
                <SortButton label="Priority" active={list.sort === "priority"} order={list.order} onClick={() => { list.setSort("priority"); list.setOrder(list.sort === "priority" && list.order === "asc" ? "desc" : "asc"); }} />
                <SortButton label="Updated" active={list.sort === "updated_at"} order={list.order} onClick={() => { list.setSort("updated_at"); list.setOrder(list.sort === "updated_at" && list.order === "asc" ? "desc" : "asc"); }} />
            </div>

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">No tickets match.</p></div>
            ) : (
                <div className="border border-border bg-card divide-y divide-border">
                    {list.items.map((t) => (
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
                </div>
            )}
            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
        </div>
    );
}
