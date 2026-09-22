import { useEffect, useState } from "react";
import { RefreshCw, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";

interface SeatMessage {
    id: string;
    sender_type: "joiner" | "host";
    message: string;
    created_at: string;
}

// Read-only admin view of a seat's joiner<->host chat thread — surfaced from
// the dispute queue, since that's where an admin needs the conversation
// history most: deciding who's telling the truth about access delivery.
export function AdminSeatChatViewer({ seatId }: { seatId: string }) {
    const { showToast } = useToast();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<SeatMessage[]>([]);
    const [chatStatus, setChatStatus] = useState<"open" | "closed">("open");

    useEffect(() => {
        if (!isExpanded) return;
        setIsLoading(true);
        ssFetch(`/api/admin/splitsubs/seat-messages?seatId=${seatId}`)
            .then((d) => { setMessages(d.messages || []); setChatStatus(d.chatStatus || "open"); })
            .catch((err) => showToast(err.message || "Could not load conversation.", "error"))
            .finally(() => setIsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isExpanded]);

    // Same reasoning as the joiner/host SeatChat: plain REST, so a message
    // sent while an admin is already looking at this thread only shows up if
    // something keeps polling.
    useEffect(() => {
        if (!isExpanded) return;
        const interval = setInterval(() => {
            ssFetch(`/api/admin/splitsubs/seat-messages?seatId=${seatId}`)
                .then((d) => { setMessages(d.messages || []); setChatStatus(d.chatStatus || "open"); })
                .catch(() => { });
        }, 5000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isExpanded]);

    return (
        <div className="border border-border bg-background">
            <button onClick={() => setIsExpanded((v) => !v)} className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold hover:bg-secondary/50 transition-colors">
                <span className="flex items-center gap-2"><MessageCircle size={14} /> View conversation</span>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {isExpanded && (
                <div className="border-t border-border p-4 space-y-2">
                    {isLoading ? (
                        <div className="flex justify-center py-6"><RefreshCw className="animate-spin text-muted-foreground" size={16} /></div>
                    ) : messages.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No messages on this seat.</p>
                    ) : (
                        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                            {messages.map((m) => (
                                <div key={m.id} className={`px-3 py-2 text-xs ${m.sender_type === "host" ? "bg-primary/10" : "bg-secondary/50"}`}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{m.sender_type}</p>
                                    <p className="whitespace-pre-wrap">{m.message}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {!isLoading && <p className="text-[10px] text-muted-foreground">Conversation is {chatStatus}.</p>}
                </div>
            )}
        </div>
    );
}
