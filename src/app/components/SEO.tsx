import { Helmet } from "react-helmet-async";

interface SEOProps {
    title?: string;
    description?: string;
    keywords?: string;
    canonical?: string;
    ogType?: string;
    ogImage?: string;
    structuredData?: object;
}

export function SEO({
    title = "CortDevs | Premium Web Solutions",
    description = "Crafting exceptional digital experiences with WordPress, Shopify, GHL, and custom full-stack solutions. Elevate your digital presence with CortDevs.",
    keywords = "web developer, build websites, wordpress, ghl, shopify, custom coding solutions, web design agency, tech solutions",
    canonical = "https://cortdevs.com",
    ogType = "website",
    ogImage = "https://cortdevs.com/og-image.jpg",
    structuredData,
}: SEOProps) {
    const fullTitle = title.includes("CortDevs") ? title : `${title} | CortDevs`;

    return (
        <Helmet>
            {/* Search Engine Optimization */}
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={keywords} />
            <link rel="canonical" href={canonical} />

            {/* Social Media (Open Graph) */}
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:type" content={ogType} />
            <meta property="og:url" content={canonical} />
            <meta property="og:image" content={ogImage} />

            {/* Twitter Cards */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={ogImage} />

            {/* Structured Data (JSON-LD) */}
            {structuredData && (
                <script type="application/ld+json">
                    {JSON.stringify(structuredData)}
                </script>
            )}
        </Helmet>
    );
}
