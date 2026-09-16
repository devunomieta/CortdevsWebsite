import { supabase } from "../../lib/supabase";

export class ApiError extends Error { }

async function parseOrThrow(res: Response) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`);
    return data;
}

// For event-owner dashboard calls — bearer is the event-scoped session token
// from POST /api/events/login (see api/_lib/eventAuth.ts), not Supabase Auth.
export async function eventFetch(path: string, token: string, init: RequestInit = {}) {
    const res = await fetch(path, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(init.headers || {}),
        },
    });
    return parseOrThrow(res);
}

// For admin panel calls — bearer is the real Supabase Auth session token.
export async function adminFetch(path: string, init: RequestInit = {}) {
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
