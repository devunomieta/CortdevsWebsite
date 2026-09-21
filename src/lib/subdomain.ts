// Shared subdomain detection — used by App.tsx for router selection and by
// ConfigContext to know when to defer to a portal's own SEO/branding
// (react-helmet-async) instead of overwriting document.title/meta/favicon
// with the shared CortDevs "main" config.
export function getIsSplitsubsSubdomain(): boolean {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    const searchParams = new URLSearchParams(window.location.search);

    return (
        hostname.startsWith('splitsubs.') ||
        hostname.includes('splitsubs.cortdevs.com') ||
        searchParams.get('mode') === 'splitsubs' ||
        searchParams.get('subdomain') === 'splitsubs'
    );
}
