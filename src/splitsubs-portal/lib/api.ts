import { supabase } from "../../lib/supabase";

export class ApiError extends Error { }

async function parseOrThrow(res: Response) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`);
    return data;
}

// Public, unauthenticated calls (catalog browse, listing detail).
export async function ssPublicFetch(path: string, init: RequestInit = {}) {
    const res = await fetch(path, {
        ...init,
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
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || ""}`,
            ...(init.headers || {}),
        },
    });
    return parseOrThrow(res);
}
