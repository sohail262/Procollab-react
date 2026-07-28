import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SITE_URL = 'https://procollab.in'
const TODAY = new Date().toISOString().split('T')[0]

// Static core routes
const staticRoutes = [
    { url: '/', changefreq: 'weekly', priority: '1.0' },
    { url: '/discover', changefreq: 'daily', priority: '0.95' },
    { url: '/trending-topics', changefreq: 'daily', priority: '0.85' },
    { url: '/login', changefreq: 'monthly', priority: '0.6' },
    { url: '/register', changefreq: 'monthly', priority: '0.7' },
]

// Domain & Skill Hub routes for Programmatic SEO
const domainHubs = [
    'computer-science',
    'machine-learning',
    'web-development',
    'design',
    'engineering',
    'business',
    'marketing',
    'artificial-intelligence',
    'data-science',
    'blockchain',
].map(slug => ({
    url: `/discover?domain=${slug}`,
    changefreq: 'weekly',
    priority: '0.8',
}))

function generateSitemapXml(urls) {
    const xmlEntries = urls.map(item => `  <url>
    <loc>${SITE_URL}${item.url}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`).join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

<!-- ===== CORE & STATIC ROUTES ===== -->
${xmlEntries}

</urlset>`
}

async function run() {
    try {
        const allRoutes = [...staticRoutes, ...domainHubs]
        const sitemapContent = generateSitemapXml(allRoutes)
        const outputPath = path.resolve(__dirname, '../public/sitemap.xml')
        fs.writeFileSync(outputPath, sitemapContent, 'utf-8')
        console.log(`[SEO] sitemap.xml generated successfully with ${allRoutes.length} URLs at ${outputPath}`)
    } catch (err) {
        console.error('[SEO] Error generating sitemap.xml:', err)
    }
}

run()
