// Employer page: find the job, then pay for featuring through a Stripe Payment Link
// (set in config.js). The payment carries the job's slug as its reference id.
import { FEATURED_PAYMENT_LINK, FEATURED_PRICE, FEATURED_DAYS } from '/config.js';

const $ = (id) => document.getElementById(id);
for (const n of document.querySelectorAll('[data-price]')) n.textContent = FEATURED_PRICE;
for (const n of document.querySelectorAll('[data-days]')) n.textContent = String(FEATURED_DAYS);

const listed = fetch('/data/jobs.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : { jobs: [] }))
  .then((d) => d.jobs ?? [])
  .catch(() => []);
const norm = (u) => {
  try {
    const x = new URL(u);
    return `${x.host.toLowerCase()}${x.pathname.replace(/\/+$/, '')}`;
  } catch {
    return u;
  }
};

async function find(value) {
  const jobs = await listed;
  const v = value.trim();
  const page = /\/job\/([a-z0-9-]+)/.exec(v)?.[1];
  return jobs.find((j) => j.id === v || j.slug === v || (page && j.slug === page) || norm(j.url) === norm(v)) ?? null;
}

async function show() {
  const value = $('feature-url').value;
  const preview = $('feature-preview');
  $('feature-buy').hidden = true;
  $('feature-waitlist').hidden = true;
  if (!value.trim()) {
    preview.textContent = '';
    return;
  }
  const job = await find(value);
  if (!job) {
    preview.textContent = "We don't list that job right now. It has to be on the site (with a salary) to be featured.";
    return;
  }
  if (!job.employerStated) {
    preview.innerHTML = '';
    preview.append(`${job.title} at ${job.company} isn't claimed yet. `, Object.assign(document.createElement('a'), { href: `/claim?url=${encodeURIComponent(job.url)}`, textContent: 'Claim it first' }), ' (free), then come back here.');
    return;
  }
  preview.textContent = `✓ ${job.title} at ${job.company}, rated ${job.rating.name} ${job.rating.emoji}`;
  if (FEATURED_PAYMENT_LINK) {
    const url = new URL(FEATURED_PAYMENT_LINK);
    url.searchParams.set(/stripe\.com$/.test(url.hostname) ? 'client_reference_id' : 'reference_id', job.slug);
    $('feature-pay').href = url.toString();
    $('feature-buy').hidden = false;
  } else {
    $('feature-job-field').value = `${job.slug} (${job.company}: ${job.title})`;
    $('feature-waitlist').hidden = false;
  }
}

$('feature-url').addEventListener('change', show);
$('feature-url').addEventListener('blur', show);
$('feature-pay').addEventListener('click', () => window.dataLayer?.push({ event: 'featured_checkout', featured_job: $('feature-url').value }));
const start = new URLSearchParams(location.search).get('job');
if (start) {
  $('feature-url').value = start;
  show();
}
