import { Helmet } from 'react-helmet-async'

/**
 * ProCollab — Centralised SEO Head Component
 *
 * Drop this inside any page and supply the relevant props.
 * Sensible defaults ensure every page has at least a baseline SEO footprint.
 */

const SITE_NAME = 'ProCollab'
const SITE_URL = 'https://procollab.in'
const DEFAULT_DESCRIPTION =
    'ProCollab is the ultimate platform for students and developers to showcase final year projects, discover domain-wise & skill-wise projects, find teammates, and collaborate in real time. Join the largest student project community.'
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`
const TWITTER_HANDLE = '@ProCollab_in'

// Global keyword bank — appended to every page's keywords list
const GLOBAL_KEYWORDS = [
    'ProCollab',
    'procollab.in',
    'student projects',
    'final year projects',
    'FYP',
    'capstone projects',
    'engineering projects',
    'CS projects',
    'project collaboration',
    'student collaboration platform',
    'find teammates',
    'team up for projects',
    'project management platform',
    'learning platform for students',
    'share projects online',
    'showcase student work',
    'domain-wise projects',
    'skill-wise projects',
    'tech project ideas',
    'software project showcase',
]

export interface SEOHeadProps {
    /** Page <title> — will be suffixed with " | ProCollab" unless you set noSuffix=true */
    title?: string
    /** <meta name="description"> */
    description?: string
    /** Comma-separated keywords (merged with global list) */
    keywords?: string[]
    /** Absolute canonical URL (defaults to current window.location.href) */
    canonical?: string
    /** OG / Twitter card image URL */
    image?: string
    /** OG type: "website" | "article" | "profile" | "product" */
    type?: string
    /** Prevent search-engine indexing (e.g. private/auth pages) */
    noIndex?: boolean
    /** Skip " | ProCollab" suffix on the title */
    noSuffix?: boolean
    /** Extra JSON-LD structured-data object(s) */
    structuredData?: object | object[]
    /** Twitter card type */
    twitterCard?: 'summary' | 'summary_large_image'
    /** Author name for article pages */
    author?: string
    /** Article / content publish date */
    publishedTime?: string
    /** Article / content modified date */
    modifiedTime?: string
}

export function SEOHead({
    title,
    description = DEFAULT_DESCRIPTION,
    keywords = [],
    canonical,
    image = DEFAULT_IMAGE,
    type = 'website',
    noIndex = false,
    noSuffix = false,
    structuredData,
    twitterCard = 'summary_large_image',
    author,
    publishedTime,
    modifiedTime,
}: SEOHeadProps) {
    const fullTitle = title
        ? noSuffix
            ? title
            : `${title} | ${SITE_NAME}`
        : `${SITE_NAME} — Student Project Collaboration & Showcase Platform`

    const canonicalUrl =
        canonical ||
        (typeof window !== 'undefined' ? window.location.href : SITE_URL)

    const allKeywords = [...GLOBAL_KEYWORDS, ...keywords].join(', ')

    // Normalise structured-data to an array for easier rendering
    const sdArray = structuredData
        ? Array.isArray(structuredData)
            ? structuredData
            : [structuredData]
        : []

    return (
        <Helmet>
            {/* ── Primary ─────────────────────────────────────── */}
            <html lang="en" />
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={allKeywords} />
            {author && <meta name="author" content={author} />}
            <link rel="canonical" href={canonicalUrl} />

            {/* ── Robots ──────────────────────────────────────── */}
            {noIndex ? (
                <meta name="robots" content="noindex, nofollow" />
            ) : (
                <meta
                    name="robots"
                    content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
                />
            )}

            {/* ── Open Graph ──────────────────────────────────── */}
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:type" content={type} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:image" content={image} />
            <meta property="og:image:alt" content={fullTitle} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:locale" content="en_IN" />

            {/* Article-specific OG */}
            {publishedTime && (
                <meta
                    property="article:published_time"
                    content={publishedTime}
                />
            )}
            {modifiedTime && (
                <meta
                    property="article:modified_time"
                    content={modifiedTime}
                />
            )}

            {/* ── Twitter Card ────────────────────────────────── */}
            <meta name="twitter:card" content={twitterCard} />
            <meta name="twitter:site" content={TWITTER_HANDLE} />
            <meta name="twitter:creator" content={TWITTER_HANDLE} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />

            {/* ── Mobile / PWA ─────────────────────────────────── */}
            <meta name="theme-color" content="#6366f1" />
            <meta name="application-name" content={SITE_NAME} />
            <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta
                name="apple-mobile-web-app-status-bar-style"
                content="black-translucent"
            />

            {/* ── JSON-LD Structured Data ──────────────────────── */}
            {sdArray.map((sd, i) => (
                <script key={i} type="application/ld+json">
                    {JSON.stringify(sd)}
                </script>
            ))}
        </Helmet>
    )
}

/* ─────────────────────────────────────────────────────────────
   Pre-built structured-data factory helpers
   ───────────────────────────────────────────────────────────── */

/** WebSite schema — used on the root landing page */
export function buildWebsiteSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        description: DEFAULT_DESCRIPTION,
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${SITE_URL}/discover?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    }
}

/** Organization schema */
export function buildOrganizationSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        sameAs: [
            'https://twitter.com/ProCollab_in',
            'https://www.linkedin.com/company/procollab',
            'https://github.com/procollab',
        ],
        contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: 'support@procollab.in',
        },
    }
}

/** SoftwareApplication schema */
export function buildSoftwareAppSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        operatingSystem: 'Web',
        applicationCategory: 'EducationApplication',
        description: DEFAULT_DESCRIPTION,
        url: SITE_URL,
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'INR',
        },
        featureList: [
            'Final Year Project Showcase',
            'Student Project Collaboration',
            'Domain-wise Project Discovery',
            'Skill-wise Team Matching',
            'Real-time Project Management',
            'Peer Learning Community',
        ],
        screenshot: DEFAULT_IMAGE,
    }
}

/** Person / Profile schema */
export function buildPersonSchema({
    name,
    username,
    bio,
    image,
    skills,
    url,
}: {
    name: string
    username: string
    bio?: string
    image?: string
    skills?: string[]
    url?: string
}) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name,
        url: url || `${SITE_URL}/u/${username}`,
        image,
        description: bio,
        knowsAbout: skills,
        memberOf: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
        },
    }
}

/** CreativeWork / Project schema */
export function buildProjectSchema({
    title,
    description,
    url,
    image,
    tags,
    author,
    datePublished,
    dateModified,
    status,
}: {
    title: string
    description: string
    url: string
    image?: string
    tags?: string[]
    author?: string
    datePublished?: string
    dateModified?: string
    status?: string
}) {
    return {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: title,
        description,
        url,
        image,
        keywords: tags?.join(', '),
        author: author
            ? { '@type': 'Person', name: author }
            : undefined,
        datePublished,
        dateModified,
        creativeWorkStatus: status,
        isPartOf: {
            '@type': 'WebSite',
            name: SITE_NAME,
            url: SITE_URL,
        },
    }
}

/** BreadcrumbList schema */
export function buildBreadcrumbSchema(
    items: Array<{ name: string; url: string }>
) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url.startsWith('http')
                ? item.url
                : `${SITE_URL}${item.url}`,
        })),
    }
}
