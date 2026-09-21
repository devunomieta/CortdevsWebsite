import { useEffect, useState } from "react";
import { ssFetch } from "./api";

const PAGE_SIZE = 20;

// One hook for every paginated table across SplitSubs — admin panel and
// dashboard alike: owns page/search/sort state, debounces search, and
// refetches whenever any of them change. `endpoint` takes the base API path
// (no query string); `itemsKey` is the response field holding the array
// (each GET names it differently — "services", "listings", "hosts", "seats",
// etc). `extraParams` re-triggers a fetch when it changes, for a
// status/category tab that isn't search or sort.
export function usePaginatedList<T>(endpoint: string, itemsKey: string, opts: { defaultSort?: string; defaultOrder?: "asc" | "desc"; extraParams?: Record<string, string> } = {}) {
    const [items, setItems] = useState<T[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState(""); // bound to the text field, updates every keystroke
    const [search, setSearch] = useState(""); // debounced value that actually drives the fetch
    const [sort, setSort] = useState(opts.defaultSort || "created_at");
    const [order, setOrder] = useState<"asc" | "desc">(opts.defaultOrder || "desc");
    const [isLoading, setIsLoading] = useState(true);

    const extraKey = JSON.stringify(opts.extraParams || {});

    // Debounce: 350ms after the last keystroke, commit to `search` and reset to page 1.
    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput);
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    const load = () => {
        setIsLoading(true);
        const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort, order, ...(search ? { search } : {}), ...(opts.extraParams || {}) });
        ssFetch(`${endpoint}?${params.toString()}`)
            .then((d) => { setItems(d[itemsKey] || []); setTotal(d.total ?? (d[itemsKey] || []).length); })
            .catch(() => { setItems([]); setTotal(0); })
            .finally(() => setIsLoading(false));
    };

    useEffect(() => { load(); }, [page, sort, order, search, extraKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return { items, total, page, setPage, totalPages, pageSize: PAGE_SIZE, searchInput, setSearchInput, sort, setSort, order, setOrder, isLoading, reload: load };
}
