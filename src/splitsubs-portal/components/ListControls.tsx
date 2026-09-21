import { Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || "Search..."}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border outline-none focus:border-primary text-sm"
            />
        </div>
    );
}

export function SortButton({ label, active, order, onClick }: { label: string; active: boolean; order: "asc" | "desc"; onClick: () => void }) {
    return (
        <button onClick={onClick} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest border flex items-center gap-1 ${active ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {label} {active && (order === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
        </button>
    );
}

export function Pagination({ page, totalPages, total, pageSize, onPage }: { page: number; totalPages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
    if (total === 0) return null;
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return (
        <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">{from}–{to} of {total}</p>
            <div className="flex items-center gap-2">
                <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="p-2 border border-border hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent">
                    <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-muted-foreground px-2">Page {page} of {totalPages}</span>
                <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="p-2 border border-border hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent">
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
