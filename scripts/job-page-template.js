// HTML for one job's page. We show our facts, rating and a link out; we never
// republish the company's own description.
const STYLE_LABELS = {
  live_algorithm: 'Live algorithm test',
  take_home: 'Take-home',
  paid_take_home: 'Paid take-home',
  unpaid_take_home: 'Unpaid take-home',
  pairing: 'Pair on real work',
  conversation: 'Just a conversation',
};
const LEVEL_BG = ['#5C1A1A', '#8A5523', '#C9893E', '#E9D16A', '#7FB3FF', '#2F5BFF'];
const LEVEL_FG = ['#FFF4CC', '#FFF4CC', '#1A1712', '#1A1712', '#1A1712', '#FFFFFF'];

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function formatPay(s) {
  if (!s) return null;
  const sym = { USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$' }[s.currency] ?? `${s.currency} `;
  const f = (n) => (s.interval === 'hour' ? `${sym}${n}` : `${sym}${Math.round(n / 1000)}k`);
  const range = s.min === s.max ? f(s.min) : `${f(s.min)}–${f(s.max)}`;
  return s.interval === 'hour' ? `${range}/hr` : s.interval === 'month' ? `${range}/mo` : range;
}

// Our own one-paragraph summary, written from the facts we extracted.
export function jobDescription(job) {
  const bits = [];
  const pay = formatPay(job.salary);
  bits.push(`${job.title} at ${job.company}${pay ? `, paying ${pay}` : ''}.`);
  if (job.remote) bits.push('Remote.');
  if (job.stack?.length) bits.push(`Stack: ${job.stack.slice(0, 6).join(', ')}.`);
  if (job.rounds) bits.push(`${job.rounds} interview rounds.`);
  if (job.interviewStyles?.length) bits.push(`Interviews: ${job.interviewStyles.map((s) => (STYLE_LABELS[s] ?? s).toLowerCase()).join(', ')}.`);
  bits.push(`Rated ${job.rating.name} ${job.rating.emoji} on the Jobbie Scale${job.redFlags?.length ? `, with ${job.redFlags.length} red flag${job.redFlags.length === 1 ? '' : 's'}` : ''}.`);
  return bits.join(' ');
}

export function renderJobPage(job, { siteUrl, gtm, where, description }) {
  const url = `${siteUrl}/job/${job.slug}`;
  const pay = formatPay(job.salary);
  const lv = job.rating.level;
  const title = `${job.title} at ${job.company}${pay ? ` (${pay})` : ''}`;
  const viaRemoteOK = job.via?.name === 'Remote OK';
  const tags = [
    pay && `<span class="tag tag-pay">${esc(pay)}</span>`,
    where && `<span class="tag where-tag">${esc(where)}</span>`,
    job.remote && '<span class="tag tag-stack">Remote</span>',
    job.rounds && `<span class="tag tag-int">${job.rounds} rounds</span>`,
    ...(job.interviewStyles ?? []).map((s) => `<span class="tag tag-int">${esc(STYLE_LABELS[s] ?? s)}</span>`),
    ...(job.stack ?? []).map((s) => `<span class="tag tag-stack">${esc(s)}</span>`),
  ].filter(Boolean).join('\n          ');
  const reasons = (job.rating.reasons ?? []).map((r) => `<li>${esc(r)}</li>`).join('');
  const flags = (job.redFlags ?? []).map((r) => `<li>${esc(r)}</li>`).join('');
  // Only what the vote widget needs, safely embedded.
  const pageData = JSON.stringify({ id: job.id, title: job.title, rating: job.rating }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${gtm}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(job.rating.name)} ${job.rating.emoji} | Full Stack Jobbies</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:title" content="${esc(title)}: rated ${esc(job.rating.name)} ${job.rating.emoji}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(url)}">
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
<section style="padding-top: 48px">
  <div class="wrap">
    <p class="mono" style="margin: 0 0 16px; font-size: 13px"><a href="/jobs">← All jobs</a></p>
    <div class="row" style="align-items: flex-start">
      <div>
        <h1 style="font-size: clamp(36px, 5vw, 56px)">${esc(job.title)}</h1>
        <p class="lede" style="margin-top: 10px">${esc([job.company, job.location].filter(Boolean).join(' · '))}</p>
        <div class="tags" style="margin-top: 24px">
          ${tags}
        </div>
        <p style="margin-top: 24px; max-width: 40em">${esc(description)}</p>
        <div style="margin-top: 28px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center">
          <a class="btn btn-accent" href="${esc(job.url)}" target="_blank" rel="noopener">${viaRemoteOK ? 'View on Remote OK' : 'Apply on their site'}</a>
          ${viaRemoteOK ? `<span style="font-size: 14px; color: var(--ink-3)">Listing via <a href="${esc(job.via.url)}" target="_blank">Remote OK</a></span>` : ''}
        </div>
      </div>
      <aside class="card" aria-label="Rating">
        <p class="eyebrow" style="color: var(--ink-3)">Our sniff test</p>
        <p style="margin: 10px 0 0"><span class="badge" style="background: ${LEVEL_BG[lv]}; color: ${LEVEL_FG[lv]}; font-size: 22px; padding: 8px 18px">${esc(job.rating.name)} ${job.rating.emoji}</span></p>
        <p style="margin: 18px 0 4px; font-weight: 700">How we got there</p>
        <ul style="margin: 0; padding-left: 20px">${reasons || '<li>Nothing stood out either way</li>'}</ul>
        ${flags ? `<p style="margin: 14px 0 4px; font-weight: 700">Red flags</p><ul style="margin: 0; padding-left: 20px">${flags}</ul>` : ''}
        <div id="vote-mount"></div>
      </aside>
    </div>
  </div>
</section>

<section class="section-tight">
  <div class="wrap">
    <div class="cta">
      <div>
        <h2 style="font-size: clamp(28px, 4vw, 44px)">Found a job somewhere else?</h2>
        <p class="lede">Paste the link or the description and we'll sniff it out in seconds.</p>
      </div>
      <a class="btn" href="/#detector">Check a job</a>
    </div>
  </div>
</section>
</main>

<footer class="site-footer">
  <div class="wrap">
    <p style="font-weight: 600">Yes, we know what "jobbie" means in Glasgow. That's the point.</p>
    <p style="color: var(--ink-3)">© 2026 fullstackjobbies.com</p>
  </div>
</footer>

<script type="application/json" id="job-data">${pageData}</script>
<script type="module" src="/job-page.js"></script>
<script type="module" src="/consent.js"></script>
</body>
</html>
`;
}
