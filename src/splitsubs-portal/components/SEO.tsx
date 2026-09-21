import { Helmet } from "react-helmet-async";

const SITE_URL = "https://splitsubs.cortdevs.com";

interface SEOProps {
    title: string;
    description: string;
    path?: string; // e.g. "/how-it-works" — defaults to "/"
    ogImage?: string;
    noindex?: boolean;
}

// One Helmet block per page, consistently shaped, instead of each page
// hand-rolling its own <title>. `path` builds the canonical + og:url from
// the real splitsubs.cortdevs.com host — the app itself is served from one
// shared Vite build across every Cortdevs subdomain, so a page's own
// window.location can't be trusted for this at build time.
export function SEO({ title, description, path = "/", ogImage = `${SITE_URL}/og-image.jpg`, noindex = false }: SEOProps) {
    const fullTitle = title.includes("SplitSubs") ? title : `${title} | SplitSubs`;
    const canonical = `${SITE_URL}${path}`;

    return (
        <Helmet>
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={canonical} />
            <link rel="icon" type="image/svg+xml" href="/splitsubs-icon.svg" />
            <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />

            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:type" content="website" />
            <meta property="og:url" content={canonical} />
            <meta property="og:image" content={ogImage} />
            <meta property="og:site_name" content="SplitSubs" />

            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={ogImage} />
        </Helmet>
    );
}
