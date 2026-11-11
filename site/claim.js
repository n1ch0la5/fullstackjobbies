// "Is this your job?" Employers state the pay range and interview process for their own
// listing. Saved as pending in Supabase; checked by hand before it counts.
import { STEPS, DURATIONS } from '/lib/reports.js';
import { supabase } from '/supa.js';

const $ = (id) => document.getElementById(id);
const VOTER_KEY = 'fsj.voter';
const STYLES = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };

function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) node.append(kid);
  return node;
}
function browserId() {
  try {
    let id = JSON.parse(localStorage.getItem(VOTER_KEY) ?? 'null');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VOTER_KEY, JSON.stringify(id));
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

const choice = (type, name, value, label) =>
  el('label', { class: 'choice' }, el('input', { type, name, value }), el('span', {}, label));
$('work-style').append(...Object.entries(STYLES).map(([v, l]) => choice('radio', 'work-style', v, l)));
$('steps').append(...Object.entries(STEPS).map(([v, l]) => choice('checkbox', 'steps', v, l)));
for (let n = 1; n <= 8; n++) $('rounds').append(el('option', { value: String(n) }, n === 8 ? '8 or more' : String(n)));
$('duration').append(...Object.entries(DURATIONS).map(([v, l]) => el('option', { value: v }, l)));

// ---------- The job ----------
let job = null;
let listedId = null;
let lookedUp = '';
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
const money = (n) => (n ? n.toLocaleString('en-US') : '');

async function lookUp() {
  const url = $('job-url').value.trim();
  if (!url || url === lookedUp) return;
  lookedUp = url;
  job = null;
  listedId = null;
  const preview = $('job-preview');
  if (!/^https?:\/\/\S+\.\S+/.test(url)) {
    preview.textContent = "That doesn't look like a link. It should start with https://";
    return;
  }
  const match = (await listed).find((j) => norm(j.url) === norm(url));
  if (match) {
    job = match;
    listedId = match.id;
    preview.textContent = `✓ ${match.title} at ${match.company}, rated ${match.rating.name} ${match.rating.emoji}`;
    // Start from what the listing says; they correct what's wrong.
    if (match.salary && !$('pay-min').value) {
      $('pay-min').value = money(match.salary.min);
      $('pay-max').value = money(match.salary.max);
      $('pay-currency').value = match.salary.currency;
      $('pay-interval').value = match.salary.interval === 'hour' ? 'hour' : 'year';
    }
    const ws = document.querySelector(`input[name=work-style][value="${match.workStyle}"]`);
    if (ws && !document.querySelector('input[name=work-style]:checked')) ws.checked = true;
    return;
  }
  preview.textContent = "This job isn't on the site yet. Claims apply once our daily sift finds it on your careers page (Greenhouse, Lever, Ashby, Workable and others).";
}
$('job-url').addEventListener('change', lookUp);
$('job-url').addEventListener('blur', lookUp);

const start = new URLSearchParams(location.search).get('url');
if (start) {
  $('job-url').value = start;
  lookUp();
}

// ---------- Send ----------
const picked = (name) => [...document.querySelectorAll(`input[name=${name}]:checked`)].map((c) => c.value);
const num = (v) => {
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

$('claim-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('claim-status');
  const button = e.target.querySelector('button[type=submit]');
  if ($('website').value) return;
  await lookUp();
  const say = (m, focus) => {
    status.textContent = m;
    focus?.focus();
  };

  const url = $('job-url').value.trim();
  const email = $('work-email').value.trim();
  let min = num($('pay-min').value);
  let max = num($('pay-max').value);
  const interval = $('pay-interval').value;
  // "140" with Per year almost certainly means 140k.
  if (interval === 'year') {
    if (min && min < 1000) min *= 1000;
    if (max && max < 1000) max *= 1000;
  }
  if (!/^https?:\/\/\S+\.\S+/.test(url)) return say('Add the link to the job posting.', $('job-url'));
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return say('Add your work email so we can check you work there.', $('work-email'));
  if (/@(gmail|yahoo|hotmail|outlook|icloud|proton|aol)\./i.test(email)) return say('Use your company email, not a personal one.', $('work-email'));
  if (!min || !max) return say('Add the pay range: the lowest and highest base salary you would offer.', $('pay-min'));
  if (max < min) return say('The top of the range is lower than the bottom.', $('pay-max'));
  if (interval === 'year' && max / min > 1.8) return say('That range is very wide. Ranges wider than 1.6x lose points; narrow it to what you would really offer.', $('pay-max'));
  if (!picked('steps').length) return say('Tick the interview steps a candidate goes through.', document.querySelector('input[name=steps]'));
  if (!$('rounds').value) return say('Pick the number of rounds.', $('rounds'));

  button.disabled = true;
  say('Sending…');
  try {
    const db = await supabase();
    const { error } = await db.rpc('submit_employer_claim', {
      p_claimant: browserId(),
      p_job_url: url,
      p_job_id: listedId,
      p_title: job?.title ?? '',
      p_company: job?.company ?? '',
      p_work_email: email,
      p_pay_min: min,
      p_pay_max: max,
      p_pay_currency: $('pay-currency').value,
      p_pay_interval: interval,
      p_work_style: picked('work-style')[0] ?? null,
      p_steps: picked('steps'),
      p_rounds: Number($('rounds').value),
      p_duration: $('duration').value || null,
    });
    if (error) throw error;
    window.dataLayer?.push({ event: 'employer_claim', claim_listed: Boolean(listedId) });
    $('claim-form').hidden = true;
    $('claim-done').hidden = false;
    $('claim-done').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    say(/slow down/i.test(err?.message ?? '') ? 'Too many claims from this browser today. Try again tomorrow.' : "That didn't send. Check your connection and try again.");
  } finally {
    button.disabled = false;
  }
});
