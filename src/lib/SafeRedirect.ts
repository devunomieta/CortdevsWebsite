const ALLOWED_HOSTS = [
    'localhost:5173',
    'cortdevs.com',
    'www.cortdevs.com',
    'admin.cortdevs.com'
];

/**
 * Validates a URL against an allowlist of trusted hosts.
 * Returns the URL if safe, otherwise returns the fallback.
 */
export function validateRedirect(url: string, fallback: string = '/admin'): string {
    if (!url) return fallback;

    try {
        // Handle relative URLs
        if (url.startsWith('/') && !url.startsWith('//')) {
            return url;
        }

        const parsedUrl = new URL(url);
        if (ALLOWED_HOSTS.includes(parsedUrl.host)) {
            return url;
        }
    } catch (e) {
        // Invalid URL
    }

    return fallback;
}
