import { supabase } from '../../lib/supabase';

export async function learnApi<T = any>(
    endpoint: string,
    options: { method?: string; body?: any; auth?: boolean } = {},
): Promise<T> {
    const { method = 'GET', body, auth = true } = options;
    const headers: Record<string, string> = {};
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    if (auth) {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }
    }

    const res = await fetch(`/api/${endpoint.replace(/^\/+/, '')}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err: any = new Error(data?.error || `Request failed (${res.status})`);
        err.status = res.status;
        err.payload = data;
        throw err;
    }
    return data as T;
}

export function formatDuration(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    return `${m}:${String(rem).padStart(2, '0')}`;
}
