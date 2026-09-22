import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, RefreshCw, Lock, Unlock, ChevronDown, ChevronUp, Flag, ShieldAlert } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";

interface SeatMessage {
    id: string;
    sender_type: "joiner" | "host";
    message: string;
    created_at: string;
}

export function SeatChat({ seatId, viewerRole }: { seatId: string; viewerRole: "joiner" | "host" }) {
    const { showToast } = useToast();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<SeatMessage[]>([]);
    const [chatStatus, setChatStatus] = useState<"open" | "closed">("open");
    const [draft, setDraft] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isReporting, setIsReporting] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Silent refresh (no spinner, no toast-on-failure) — used by polling so a
    // flaky tick doesn't flash the panel or nag the user; the visible `load`
    // below is only for the initial open.
    const loadSilently = () => {
        ssFetch(`/api/splitsubs/seat-messages?seatId=${seatId}`)
            .then((d) => { setMessages(d.messages || []); setChatStatus(d.chatStatus || "open"); })
            .catch(() => { });
    };

    const load = () => {
        setIsLoading(true);
        ssFetch(`/api/splitsubs/seat-messages?seatId=${seatId}`)
            .then((d) => { setMessages(d.messages || []); setChatStatus(d.chatStatus || "open"); })
            .catch((err) => showToast(err.message || "Could not load conversation.", "error"))
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        if (isExpanded) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isExpanded]);

    // Plain REST, no realtime plumbing here — polling while the panel is
    // open is the simplest way for a message the other party sends mid-chat
    // to actually show up without closing/reopening or a full page refresh.
    useEffect(() => {
        if (!isExpanded) return;
        const interval = setInterval(loadSilently, 5000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isExpanded]);

    useEffect(() => { bottomRef.current?.scrollIntoView({ block: "nearest" }); }, [messages]);

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!draft.trim()) return;
        setIsSending(true);
        try {
            const result = await ssFetch("/api/splitsubs/seat-messages", { method: "POST", body: JSON.stringify({ seatId, message: draft }) });
            setMessages((prev) => [...prev, result.message]);
            setDraft("");
            if (result.warning) showToast(result.warning, "error");
        } catch (err: any) {
            showToast(err.message || "Could not send message.", "error");
        } finally {
            setIsSending(false);
        }
    };

    const report = async () => {
        const reason = window.prompt("What's wrong with this conversation? (sent to SplitSubs support)");
        if (!reason) return;
        setIsReporting(true);
        try {
            await ssFetch("/api/splitsubs/tickets", {
                method: "POST",
                body: JSON.stringify({ category: "other", subject: "Reported a seat conversation", message: reason, seatId }),
            });
            showToast("Reported — support will review this conversation.", "success");
        } catch (err: any) {
            showToast(err.message || "Could not report this conversation.", "error");
        } finally {
            setIsReporting(false);
        }
    };

    const toggleChat = async () => {
        const action = chatStatus === "open" ? "close" : "reopen";
        try {
            await ssFetch("/api/splitsubs/seat-messages", { method: "POST", body: JSON.stringify({ action, seatId }) });
            setChatStatus(action === "close" ? "closed" : "open");
        } catch (err: any) {
            showToast(err.message || "Could not update conversation.", "error");
        }
    };

    return (
        <div className="border border-border bg-background">
            <button onClick={() => setIsExpanded((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold hover:bg-secondary/50 transition-colors">
                <span className="flex items-center gap-2"><MessageCircle size={14} /> Message {viewerRole === "joiner" ? "host" : "joiner"}</span>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {isExpanded && (
                <div className="border-t border-border p-4 space-y-3">
                    {isLoading ? (
                        <div className="flex justify-center py-6"><RefreshCw className="animate-spin text-muted-foreground" size={16} /></div>
                    ) : (
                        <>
                            <p className="text-[10px] text-muted-foreground flex items-start gap-1.5"><ShieldAlert size={12} className="shrink-0 mt-0.5" /> SplitSubs staff can view this conversation if a dispute is opened.</p>
                            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                                {messages.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No messages yet — say hello.</p>}
                                {messages.map((m) => (
                                    <div key={m.id} className={`max-w-[85%] px-3 py-2 text-xs ${m.sender_type === viewerRole ? "ml-auto bg-primary/10 text-right" : "bg-secondary/50"}`}>
                                        <p className="whitespace-pre-wrap">{m.message}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                                    </div>
                                ))}
                                <div ref={bottomRef} />
                            </div>
                            {chatStatus === "closed" ? (
                                <p className="text-xs text-muted-foreground text-center py-1">This conversation is closed.</p>
                            ) : (
                                <form onSubmit={send} className="flex gap-2">
                                    <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." maxLength={5000} className="flex-1 min-w-0 px-3 py-2 bg-card border border-border outline-none focus:border-primary text-xs" />
                                    <button type="submit" disabled={isSending || !draft.trim()} className="px-3 py-2 bg-primary text-primary-foreground disabled:opacity-50 shrink-0">
                                        {isSending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                    </button>
                                </form>
                            )}
                            {viewerRole === "joiner" && chatStatus === "open" && (
                                <p className="text-[10px] text-muted-foreground">Closing this doesn't confirm access — use "Confirm It's Working" above to release the host's payout.</p>
                            )}
                            <div className="flex items-center justify-between">
                                <button onClick={toggleChat} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                                    {chatStatus === "open" ? <><Lock size={12} /> Close conversation</> : <><Unlock size={12} /> Reopen conversation</>}
                                </button>
                                <button onClick={report} disabled={isReporting} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive flex items-center gap-1.5 disabled:opacity-50">
                                    <Flag size={12} /> Report
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
