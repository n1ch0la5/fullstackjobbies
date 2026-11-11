// Landing pages for search: "Remote full stack React jobs", "Full stack jobs in Canada",
// "Full stack jobs paying $150k+"… Each is a static page listing the matching jobs, so
// Google sees real content. A page only exists while it has at least MIN_JOBS jobs; with
// fewer it would be thin, and Google treats thin pages as low quality.
import { annualUsd } from '../src/score.js';
import { describeWhere } from '../src/location.js';
import { formatPay, LEVEL_BG, LEVEL_FG } from './job-page-template.js';

export const MIN_JOBS = 3;
const MAX_CARDS = 60;

// Languages and frameworks only: people search "React jobs", not "Docker jobs".
const STACKS = {
  react: 'React', typescript: 'TypeScript', javascript: 'JavaScript', python: 'Python', golang: 'Go', java: 'Java',
  'c#': 'C#', '.net': '.NET', node: 'Node.js', angular: 'Angular', vue: 'Vue', kotlin: 'Kotlin', 'react native': 'React Native',
  'next.js': 'Next.js', graphql: 'GraphQL', ruby: 'Ruby', rails: 'Rails', django: 'Django', fastapi: 'FastAPI', php: 'PHP',
  laravel: 'Laravel', rust: 'Rust', postgres: 'Postgres', elixir: 'Elixir', swift: 'Swift', svelte: 'Svelte',
};
const stackSlug = (s) => s.replace('c#', 'csharp').replace('.net', 'dotnet').replace('next.js', 'nextjs').replace(/[^a-z0-9]+/g, '-');

const PLACES = [
  { slug: 'us', name: 'in the US', test: (j) => j.where?.countries?.includes('US') },
  { slug: 'canada', name: 'in Canada', test: (j) => j.where?.countries?.includes('CA') },
  { slug: 'uk', name: 'in the UK', test: (j) => j.where?.countries?.includes('GB') },
  { slug: 'europe', name: 'in Europe', test: (j) => (j.where?.countries ?? []).some((c) => ['GB', 'IE', 'DE', 'NL', 'FR', 'ES', 'PT', 'PL', 'AT', 'GR', 'IT', 'SE', 'DK', 'FI', 'NO', 'BE', 'CH', 'CZ', 'RO'].includes(c)) },
];
const PAY_FLOORS = [120000, 150000, 180000];
const isRemote = (j) => j.remote || j.workStyle === 'remote';
const mid = (j) => {
  const p = annualUsd(j.salary);
  return p ? (p.min + p.max) / 2 : 0;
};

// Every page that has enough jobs, each with its group for the hub and related links.
export function landingPages(jobs) {
  const pages = [];
  const add = (page) => {
    const list = jobs.filter(page.test);
    if (list.length >= MIN_JOBS) pages.push({ ...page, jobs: list });
  };
  add({ slug: 'remote-full-stack-jobs', group: 'Remote', h1: 'Remote full stack jobs', noun: 'remote full stack jobs', test: isRemote });
  for (const pl of PLACES) {
    add({ slug: `full-stack-jobs-${pl.slug}`, group: 'Place', h1: `Full stack jobs ${pl.name}`, noun: `full stack jobs ${pl.name}`, test: pl.test });
    add({ slug: `remote-full-stack-jobs-${pl.slug}`, group: 'Remote', h1: `Remote full stack jobs ${pl.name}`, noun: `remote full stack jobs ${pl.name}`, test: (j) => isRemote(j) && pl.test(j) });
  }
  for (const floor of PAY_FLOORS) {
    const k = `${floor / 1000}k`;
    add({ slug: `full-stack-jobs-${k}`, group: 'Pay', h1: `Full stack jobs paying $${k}+`, noun: `full stack jobs paying $${k} or more`, test: (j) => mid(j) >= floor });
    add({ slug: `remote-full-stack-jobs-${k}`, group: 'Pay', h1: `Remote full stack jobs paying $${k}+`, noun: `remote full stack jobs paying $${k} or more`, test: (j) => isRemote(j) && mid(j) >= floor });
  }
  for (const [key, name] of Object.entries(STACKS)) {
    const has = (j) => j.stack?.includes(key);
    add({ slug: `full-stack-${stackSlug(key)}-jobs`, group: 'Stack', stack: key, h1: `Full stack ${name} jobs`, noun: `full stack ${name} jobs`, test: has });
    add({ slug: `remote-full-stack-${stackSlug(key)}-jobs`, group: 'Stack', stack: key, h1: `Remote full stack ${name} jobs`, noun: `remote full stack ${name} jobs`, test: (j) => isRemote(j) && has(j) });
  }
  return pages;
}

// The pages a job appears on, best first, for "More like this" on its own page.
export function pagesForJob(job, pages, limit = 5) {
  const order = { Stack: 0, Remote: 1, Place: 2, Pay: 3 };
  return pages
    .filter((p) => p.jobs.includes(job))
    .sort((a, b) => order[a.group] - order[b.group] || a.jobs.length - b.jobs.length)
    .slice(0, limit);
}

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const shortDate = (v) => {
  const plain = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? '');
  if (!plain) return '';
  return new Date(Date.UTC(+plain[1], +plain[2] - 1, +plain[3], 12)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

function card(j) {
  const lv = j.rating.level;
  const where = describeWhere(j.where);
  const when = j.postedAt ? `Posted ${shortDate(j.postedAt)}` : `Found ${shortDate(j.firstSeen)}`;
  const tags = [
    `<span class="tag tag-pay">${esc(formatPay(j.salary))}</span>`,
    where && `<span class="tag where-tag">${esc(where)}</span>`,
    isRemote(j) && '<span class="tag tag-stack">Remote</span>',
    j.rounds && `<span class="tag tag-int">${j.rounds} rounds</span>`,
    ...(j.stack ?? []).slice(0, 5).map((s) => `<span class="tag tag-stack">${esc(s)}</span>`),
    j.redFlags?.length && `<span class="tag tag-flag">${j.redFlags.length} red flag${j.redFlags.length === 1 ? '' : 's'}</span>`,
  ].filter(Boolean).join('');
  return `<article class="job">
  <div class="job-main">
    <h3><a class="job-link" href="/job/${esc(j.slug)}">${esc(j.title)}</a></h3>
    <p class="co">${esc([j.company, j.location].filter(Boolean).join(' · '))}</p>
    <div class="tags">${tags}</div>
    <p class="job-when">${esc(when)}</p>
  </div>
  <div class="job-side">
    <span class="badge job-rating" style="background:${LEVEL_BG[lv]};color:${LEVEL_FG[lv]};font-size:16px;padding:6px 14px">${esc(j.rating.name)} ${j.rating.emoji}</span>
    <a class="btn" href="/job/${esc(j.slug)}" style="padding:10px 16px;font-size:15px">Why this rating</a>
  </div>
</article>`;
}

function shell({ title, description, url, gtm, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${gtm}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="https://fullstackjobbies.com/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="Full Stack Jobbies">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FFF4CC">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="site-header">
  <nav class="wrap nav" aria-label="Main">
    <a href="/" class="logo">
      <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true" fill="#6B3F14" stroke="#1A1712" stroke-width="2" stroke-linejoin="round"><path d="M5 27h22a3.5 3.5 0 0 0 0-7h-1.5a3.5 3.5 0 0 0-2.5-6h-1.5a4.5 4.5 0 0 0-5.5-6.5c.5 2-1.5 3-3 3.5a3.5 3.5 0 0 0-2.5 9H6.5A3.5 3.5 0 0 0 5 27z"/></svg>
      fullstack<span>jobbies</span>
    </a>
    <div class="nav-links">
      <a href="/#weekly">Rocket &amp; Jobbie of the Week</a>
      <a href="/#detector">Red Flag Detector</a>
      <a href="/agents">For agents</a>
      <a href="/jobs" class="btn btn-accent">Explore jobs</a>
    </div>
  </nav>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p style="font-weight: 600">Yes, we know what "jobbie" means in Glasgow. That's the point.</p>
    <p style="color: var(--ink-3)">© 2026 fullstackjobbies.com · <a href="/browse/">Browse jobs</a> · <a href="https://chromewebstore.google.com/detail/full-stack-jobbies-job-sn/fdkpdmocbneaobpaaddejjchpcfijbik" target="_blank" rel="noopener">Chrome extension</a> · <a href="/privacy">Privacy</a></p>
  </div>
</footer>
<script type="module" src="/consent.js"></script>
</body>
</html>
`;
}

const byBest = (a, b) => b.rating.level - a.rating.level || mid(b) - mid(a);
const k = (n) => `$${Math.round(n / 1000)}k`;

export function renderLandingPage(page, pages, { siteUrl, gtm, updatedAt }) {
  const url = `${siteUrl}/browse/${page.slug}`;
  const list = [...page.jobs].sort(byBest);
  const mids = list.map(mid).filter(Boolean).sort((a, b) => a - b);
  const median = mids.length ? mids[Math.floor(mids.length / 2)] : 0;
  const good = list.filter((j) => j.rating.level >= 4).length;
  const updated = shortDate(updatedAt);
  const n = list.length;
  const description = `${n} ${page.noun}, every one with the salary listed${median ? ` (median ${k(median)})` : ''} and rated from Rocket ship to Bloody mess. Updated ${updated}.`;

  // Related: the same stack remote or not, then the rest of its group, then a few other groups.
  const others = pages.filter((p) => p !== page);
  const related = [
    ...others.filter((p) => page.stack && p.stack === page.stack),
    ...others.filter((p) => p.group === page.group && !(page.stack && p.stack === page.stack)),
    ...others.filter((p) => p.group !== page.group && p.stack !== page.stack),
  ].slice(0, 14);

  const body = `<section style="padding-top: 56px">
  <div class="wrap">
    <p class="mono" style="margin: 0 0 16px; font-size: 13px"><a href="/browse/">← Browse all</a></p>
    <h1 style="font-size: clamp(36px, 5.5vw, 60px)">${esc(page.h1)}</h1>
    <p class="lede">${n} job${n === 1 ? '' : 's'}, every one with the salary listed${median ? `; the median pays ${k(median)}` : ''}. ${good} rated Solid or better. Rated from Rocket ship to Bloody mess, with the reasons on each job's page. Updated ${esc(updated)}.</p>
    <p style="margin: 18px 0 0"><a class="btn" href="/jobs">Filter by pay, place and interview style</a></p>
    <div class="job-list" style="margin-top: 32px">
${list.slice(0, MAX_CARDS).map(card).join('\n')}
    </div>
    ${n > MAX_CARDS ? `<p style="margin-top: 24px">Showing the best ${MAX_CARDS} of ${n}. <a href="/jobs">See them all on the jobs page</a>.</p>` : ''}
    <h2 style="font-size: 28px; margin-top: 56px">Related searches</h2>
    <ul class="browse-links">${related.map((p) => `<li><a href="/browse/${p.slug}">${esc(p.h1)}</a> <span>${p.jobs.length}</span></li>`).join('')}</ul>
  </div>
</section>`;
  return shell({ title: `${page.h1}, rated (${n} open) | Full Stack Jobbies`, description, url, gtm, body });
}

export function renderBrowseHub(pages, { siteUrl, gtm, updatedAt, total }) {
  const groups = [
    ['Stack', 'By language or framework'],
    ['Remote', 'Remote'],
    ['Place', 'By place'],
    ['Pay', 'By pay'],
  ];
  const body = `<section style="padding-top: 56px">
  <div class="wrap">
    <h1 style="font-size: clamp(36px, 5.5vw, 60px)">Browse full stack jobs</h1>
    <p class="lede">${total} full stack jobs with the salary listed, rated from Rocket ship to Bloody mess. Updated ${esc(shortDate(updatedAt))}.</p>
    ${groups.map(([g, title]) => {
      const list = pages.filter((p) => p.group === g);
      return list.length ? `<h2 style="font-size: 28px; margin-top: 40px">${title}</h2><ul class="browse-links">${list.map((p) => `<li><a href="/browse/${p.slug}">${esc(p.h1)}</a> <span>${p.jobs.length}</span></li>`).join('')}</ul>` : '';
    }).join('\n    ')}
  </div>
</section>`;
  return shell({
    title: 'Browse full stack jobs by stack, place and pay | Full Stack Jobbies',
    description: `${total} full stack jobs with salaries, rated. Browse by stack (React, TypeScript, Python…), remote, place and pay.`,
    url: `${siteUrl}/browse/`,
    gtm,
    body,
  });
}
