import { useEffect, useState } from "react";
import { RefreshCw, Plus, Send } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";

const CATEGORIES = [
    { value: "payment", label: "Payment issue" },
    { value: "access", label: "Access not working" },
    { value: "host_unresponsive", label: "Host unresponsive" },
    { value: "refund", label: "Refund request" },
    { value: "account_security", label: "Account / security" },
    { value: "other", label: "Other" },
];

function TicketThread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
    const { showToast } = useToast();
    const [ticket, setTicket] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [reply, setReply] = useState("");
    const [isSending, setIsSending] = useState(false);

    const load = () => ssFetch(`/api/splitsubs/tickets?id=${ticketId}`).then((d) => { setTicket(d.ticket); setMessages(d.messages || []); }).catch(() => { });
    useEffect(() => { load(); }, [ticketId]);

    const sendReply = async () => {
        if (!reply.trim()) return;
        setIsSending(true);
        try {
            await ssFetch("/api/splitsubs/tickets", { method: "POST", body: JSON.stringify({ action: "reply", ticketId, message: reply }) });
            setReply("");
            load();
        } catch (err: any) {
            showToast(err.message || "Could not send message.", "error");
        } finally {
            setIsSending(false);
        }
    };

    if (!ticket) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>;

    return (
        <div className="space-y-6">
            <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">← Back to tickets</button>
            <div>
                <h2 className="text-xl font-light tracking-tight">{ticket.subject}</h2>
                <p className="text-xs text-muted-foreground">{ticket.priority} · {ticket.status}</p>
            </div>
            <div className="space-y-3">
                {messages.map((m) => (
                    <div key={m.id} className={`p-4 text-sm max-w-lg ${m.sender_type === "admin" ? "bg-secondary" : "bg-primary/10 ml-auto"}`}>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">{m.sender_type === "admin" ? "SplitSubs Support" : "You"}</p>
                        {m.message}
                    </div>
                ))}
            </div>
            {ticket.status !== "closed" && (
                <div className="flex gap-2">
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} className="flex-1 px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm resize-none" placeholder="Type a reply..." />
                    <button onClick={sendReply} disabled={isSending} className="px-4 bg-primary text-primary-foreground disabled:opacity-50"><Send size={16} /></button>
                </div>
            )}
        </div>
    );
}

export function Support() {
    const { showToast } = useToast();
    const [selected, setSelected] = useState<string | null>(null);
    const [showNew, setShowNew] = useState(false);
    const [category, setCategory] = useState("other");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const list = usePaginatedList<any>("/api/splitsubs/tickets", "tickets", { defaultSort: "updated_at" });

    const submitTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await ssFetch("/api/splitsubs/tickets", { method: "POST", body: JSON.stringify({ category, subject, message }) });
            showToast("Ticket opened.", "success");
            setShowNew(false); setSubject(""); setMessage("");
            list.reload();
        } catch (err: any) {
            showToast(err.message || "Could not open ticket.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (selected) return <TicketThread ticketId={selected} onBack={() => { setSelected(null); list.reload(); }} />;

    return (
        <div className="max-w-3xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-light tracking-tight mb-1">Support</h1>
                    <p className="text-sm text-muted-foreground">Payment or access issues get priority routing.</p>
                </div>
                <button onClick={() => setShowNew((v) => !v)} className="px-4 py-2.5 border border-border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-secondary">
                    <Plus size={14} /> New Ticket
                </button>
            </div>

            {showNew && (
                <form onSubmit={submitTicket} className="border border-border p-6 bg-card space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</label>
                        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm">
                            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subject</label>
                        <input required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Message</label>
                        <textarea required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm resize-none" />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">Submit</button>
                </form>
            )}

            <div className="flex flex-wrap gap-2 items-center">
                <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search by subject..." />
                <SortButton label="Updated" active={list.sort === "updated_at"} order={list.order} onClick={() => { list.setSort("updated_at"); list.setOrder(list.sort === "updated_at" && list.order === "asc" ? "desc" : "asc"); }} />
            </div>

            {list.isLoading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
            ) : list.items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-border"><p className="text-muted-foreground text-sm">No tickets match.</p></div>
            ) : (
                <div className="space-y-3">
                    {list.items.map((t) => (
                        <button key={t.id} onClick={() => setSelected(t.id)} className="w-full text-left border border-border p-4 bg-card hover:border-primary transition-colors flex items-center justify-between">
                            <div>
                                <p className="font-medium text-sm">{t.subject}</p>
                                <p className="text-xs text-muted-foreground">{t.priority} · {t.category.replace(/_/g, " ")}</p>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-secondary">{t.status}</span>
                        </button>
                    ))}
                </div>
            )}
            <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
        </div>
    );
}
