const { collections } = require('../config/collections');

const DEFAULT_SITE_URL = 'https://uliastore.com.ua';

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const getSiteUrl = () => trimTrailingSlash(
  process.env.SITE_URL ||
  process.env.CLIENT_URL ||
  process.env.FRONTEND_URL ||
  DEFAULT_SITE_URL
);

const escapeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const toLastMod = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const routeSegment = (value) => encodeURIComponent(String(value || ''));

const urlEntry = ({ loc, lastmod, changefreq = 'weekly', priority = '0.7' }) => `
  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${toLastMod(lastmod)}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;

const getSitemapXml = async () => {
  const siteUrl = getSiteUrl();
  const [categories, products] = await Promise.all([
    collections.CATEGORIES.find({
      deletedAt: null,
      isActive: true,
      isVisible: true,
    }).project({ slug: 1, updatedAt: 1 }).toArray(),
    collections.MERCHANDISE.find({
      deletedAt: null,
      isActive: true,
      isVisible: true,
    }).project({ slug: 1, updatedAt: 1 }).toArray(),
  ]);

  const entries = [
    urlEntry({ loc: `${siteUrl}/`, changefreq: 'daily', priority: '1.0' }),
    urlEntry({ loc: `${siteUrl}/new-arrivals`, changefreq: 'daily', priority: '0.8' }),
    ...categories
      .filter((category) => category.slug)
      .map((category) => urlEntry({
        loc: `${siteUrl}/category/${routeSegment(category.slug)}`,
        lastmod: category.updatedAt,
        changefreq: 'weekly',
        priority: '0.8',
      })),
    ...products
      .filter((product) => product.slug)
      .map((product) => urlEntry({
        loc: `${siteUrl}/product/${routeSegment(product.slug)}`,
        lastmod: product.updatedAt,
        changefreq: 'weekly',
        priority: '0.7',
      })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}
</urlset>
`;
};

const getRobotsTxt = () => {
  const siteUrl = getSiteUrl();
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /checkout',
    'Disallow: /purchase-history',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
};

module.exports = {
  getSitemapXml,
  getRobotsTxt,
};
