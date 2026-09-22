import { supabase } from "../../lib/supabase";

export class ApiError extends Error { }

async function parseOrThrow(res: Response) {
    const data = await res.json().catch(() => ({}));
    // The local dev API shim (scripts/api-server.ts) wraps any uncaught
    // handler error in a generic { error: 'Intelligence Link Failure',
    // message: String(error) } — `message` carries the actual cause and only
    // ever appears from that shim, never from a real Vercel deployment, so
    // preferring it here can't hide a real production error string.
    if (!res.ok) throw new ApiError(data.message || data.error || `Request failed (${res.status})`);
    return data;
}

// Public, unauthenticated calls (catalog browse, listing detail).
export async function ssPublicFetch(path: string, init: RequestInit = {}) {
    const res = await fetch(path, {
        ...init,
        // Every list/detail refetch after a mutation re-issues the exact same
        // GET URL — without this, the browser's HTTP cache can silently hand
        // back the pre-mutation response instead of hitting the network,
        // which looks identical to "the action didn't do anything" until a
        // hard refresh bypasses the cache.
        cache: "no-store",
        headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
    return parseOrThrow(res);
}

// Authenticated calls — hosts, joiners, and admins are all real Supabase Auth
// users here (unlike the Events portal's separate credential scheme), so one
// helper covers the dashboard and the admin panel alike.
export async function ssFetch(path: string, init: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(path, {
        ...init,
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || ""}`,
            ...(init.headers || {}),
        },
    });
    return parseOrThrow(res);
}
