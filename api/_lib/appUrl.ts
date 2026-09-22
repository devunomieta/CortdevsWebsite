const LOCAL_URL_RE = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i;

// VITE_APP_URL is a Vite-prefixed env var meant for the browser bundle
// (import.meta.env picks it up per-environment automatically), but several
// backend handlers — across both the SplitSubs subdomain and the main
// cortdevs.com site — also read it via process.env to build redirect and
// email links. Convenient since it's already configured, but risky: it's
// easy to leave a deployment's server-side env vars pointed at the .env
// default (http://localhost:5173) instead of a production-specific value,
// and unlike the client build there's no separate safety net catching it.
// This is exactly what broke the post-payment Paystack redirect in
// production — refuse anything that looks like a local/private address and
// fall back to the caller's real production URL instead of trusting it
// blindly. `fallback` is per-caller since this app serves multiple domains
// (splitsubs.cortdevs.com vs cortdevs.com) with no single correct default.
export function getAppBaseUrl(fallback: string): string {
    const configured = process.env.VITE_APP_URL;
    if (!configured || LOCAL_URL_RE.test(configured)) return fallback;
    return configured;
}
