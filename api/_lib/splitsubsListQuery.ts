import type { VercelRequest } from '@vercel/node';

export interface ListParams {
    page: number;
    pageSize: number;
    search: string;
    sort: string;
    order: 'asc' | 'desc';
    from: number;
    to: number;
}

// Shared pagination/sort/search parsing for every admin list endpoint —
// ?page=&pageSize=&search=&sort=&order=. `allowedSorts` guards against
// sorting by an arbitrary/unindexed column from the query string; an
// unrecognized value silently falls back to `defaultSort` rather than erroring,
// since a stale sort param (e.g. after a column was renamed) shouldn't break the page.
export function parseListParams(req: VercelRequest, opts: { allowedSorts: string[]; defaultSort: string }): ListParams {
    const page = Math.max(1, Math.trunc(Number(req.query.page)) || 1);
    const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(req.query.pageSize)) || 20));
    const search = String(req.query.search || '').trim().slice(0, 200);
    const rawSort = String(req.query.sort || opts.defaultSort);
    const sort = opts.allowedSorts.includes(rawSort) ? rawSort : opts.defaultSort;
    const order: 'asc' | 'desc' = req.query.order === 'asc' ? 'asc' : 'desc';
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    return { page, pageSize, search, sort, order, from, to };
}

// Escapes the wildcards ilike would otherwise interpret, so a search for
// "50%" or "a_b" matches literally instead of acting as a pattern.
export function likeTerm(search: string): string {
    return `%${search.replace(/[%_]/g, (c) => `\\${c}`)}%`;
}
