// Builds what the static site needs into site/ before Netlify publishes it:
//   - public data files and the shared rating code
//   - one page per job at /job/<slug>, plus sitemap.xml and robots.txt
// Only public files go out: worst-jobbie candidates name real companies, so
// they stay private until someone anonymises one for the Friday post.
import { cp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Bump to redraw every job's preview image after changing scripts/og-image.js.
const OG_VERSION = 1;
import { jobSlug } from '../src/slug.js';
import { describeWhere } from '../src/location.js';
import { renderJobPage, jobDescription } from './job-page-template.js';

const SITE_URL = process.env.URL || 'https://fullstackjobbies.com';
const PUBLIC_DATA = ['best-jobbie-candidates.json', 'stats.json'];
const SHARED_CODE = ['extract.js', 'score.js', 'location.js', 'slug.js', 'reports.js'];

await mkdir('site/data', { recursive: true });
await mkdir('site/lib', { recursive: true });

for (const f of PUBLIC_DATA) {
  try {
    await access(`data/${f}`);
    await cp(`data/${f}`, `site/data/${f}`);
  } catch {
    // Not there before the first sift; pages cope.
  }
}
for (const f of SHARED_CODE) await cp(`src/${f}`, `site/lib/${f}`);

// Jobs: older data may predate slugs, so fill them in here.
let data = { updatedAt: null, count: 0, jobs: [] };
try {
  data = JSON.parse(await readFile('data/jobs.json', 'utf8'));
} catch {
  // Before the first sift: ship an empty list so the jobs page shows its empty state.
}
for (const j of data.jobs) j.slug ??= jobSlug(j);
await writeFile('site/data/jobs.json', JSON.stringify(data));

// One page per job. Rebuilt from scratch each deploy so filled jobs disappear.
await rm('site/job', { recursive: true, force: true });
await mkdir('site/job', { recursive: true });
const gtm = (await readFile('site/index.html', 'utf8')).match(/<!-- Google Tag Manager[\s\S]*?<!-- End Google Tag Manager -->/)?.[0] ?? '';
for (const job of data.jobs) {
  await writeFile(`site/job/${job.slug}.html`, renderJobPage(job, { siteUrl: SITE_URL, gtm, where: describeWhere(job.where), description: jobDescription(job) }));
}

// A preview image per job for shared links. Netlify keeps node_modules between builds, so
// images are cached there by content and only new or changed jobs are drawn (~0.1s each).
const OG_CACHE = 'node_modules/.cache/fsj-og';
await rm('site/og/job', { recursive: true, force: true });
await mkdir('site/og/job', { recursive: true });
await mkdir(OG_CACHE, { recursive: true });
let drawn = 0;
try {
  const { renderOgImage } = await import('./og-image.js');
  for (const job of data.jobs) {
    const where = describeWhere(job.where);
    const key = createHash('sha1')
      .update(JSON.stringify([OG_VERSION, job.title, job.company, where, job.location, job.rating.level, job.rating.name, job.salary, job.redFlags?.length ?? 0]))
      .digest('hex');
    const cached = `${OG_CACHE}/${key}.png`;
    try {
      await access(cached);
    } catch {
      await writeFile(cached, await renderOgImage(job, where));
      drawn++;
    }
    await cp(cached, `site/og/job/${job.slug}.png`);
  }
  console.log(`og images: ${drawn} drawn, ${data.jobs.length - drawn} from cache`);
} catch (e) {
  // Never fail a deploy over preview images; pages fall back to the site-wide one.
  console.warn(`og images skipped: ${e.message}`);
  for (const job of data.jobs) await cp('site/og.png', `site/og/job/${job.slug}.png`).catch(() => {});
}

// Sitemap and robots.txt so search engines find every job page.
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE_URL}/`, lastmod: today },
  { loc: `${SITE_URL}/jobs`, lastmod: (data.updatedAt ?? '').slice(0, 10) || today },
  { loc: `${SITE_URL}/agents`, lastmod: today },
  ...data.jobs.map((j) => ({ loc: `${SITE_URL}/job/${j.slug}`, lastmod: (j.firstSeen ?? today).slice(0, 10) })),
];
await writeFile(
  'site/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
);
await writeFile('site/robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`site/ ready: ${data.jobs.length} job pages`);
