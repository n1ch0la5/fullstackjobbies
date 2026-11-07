// "How did the interview go?" form. Fixed choices only; saved as pending in Supabase
// and shown on the site only after a person approves it.
import { STAGES, STEPS, DURATIONS, TAGS } from '/lib/reports.js';
import { supabase } from '/supa.js';

const $ = (id) => document.getElementById(id);
const VOTER_KEY = 'fsj.voter'; // same random browser id the votes use
const DRAFT_KEY = 'fsj.report.draft'; // handed over from the Red Flag Detector

function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) node.append(kid);
  return node;
}
function reporterId() {
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
function track(event, params) {
  window.dataLayer?.push({ event, ...params });
}

// ---------- Choices ----------
const choice = (type, name, value, label) =>
  el('label', { class: 'choice' }, el('input', { type, name, value }), el('span', {}, label));
$('stage').append(...Object.entries(STAGES).map(([v, l]) => choice('radio', 'stage', v, l)));
$('steps').append(...Object.entries(STEPS).map(([v, l]) => choice('checkbox', 'steps', v, l)));
$('tags').append(...Object.entries(TAGS).map(([v, l]) => choice('checkbox', 'tags', v, l)));
for (let n = 1; n <= 8; n++) $('rounds').append(el('option', { value: String(n) }, n === 8 ? '8 or more' : String(n)));
$('duration').append(...Object.entries(DURATIONS).map(([v, l]) => el('option', { value: v }, l)));

// The interview questions only make sense once you got past applying.
function syncProcess() {
  const stage = document.querySelector('input[name=stage]:checked')?.value;
  $('process').disabled = stage === 'applied';
  $('process').classList.toggle('is-off', stage === 'applied');
}
for (const r of document.querySelectorAll('input[name=stage]')) r.addEventListener('change', syncProcess);

// ---------- The job ----------
let job = null; // what we read from the link: { title, company, salary, … }
let listedId = null; // set when the job is already on the site
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
const payText = (s) => {
  if (!s) return null;
  const sym = { USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$' }[s.currency] ?? `${s.currency} `;
  const f = (n) => (s.interval === 'hour' ? `${sym}${n}` : `${sym}${Math.round(n / 1000)}k`);
  return s.min === s.max ? f(s.min) : `${f(s.min)}–${f(s.max)}`;
};

async function lookUp() {
  const url = $('job-url').value.trim();
  if (!url || url === lookedUp) return;
  lookedUp = url;
  job = null;
  listedId = null;
  const preview = $('job-preview');
  if (!/^https?:\/\/\S+\.\S+/.test(url)) {
    preview.textContent = 'That doesn\'t look like a link. It should start with https://';
    return;
  }
  const match = (await listed).find((j) => norm(j.url) === norm(url));
  if (match) {
    listedId = match.id;
    job = match;
    preview.textContent = `✓ ${match.title} at ${match.company} is already on the site. Your report gets added to it.`;
    $('desc-wrap').hidden = true;
    return;
  }
  preview.textContent = '👃 Reading the job…';
  try {
    const res = await fetch(`/api/read-job?url=${encodeURIComponent(url)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error);
    job = data;
    const bits = [data.title, data.company && `at ${data.company}`, payText(data.salary)].filter(Boolean).join(' ');
    preview.textContent = bits ? `✓ ${bits}` : '✓ Got it.';
    $('desc-wrap').hidden = true;
    if (!data.salary) {
      preview.textContent += '. We didn\'t find a salary: jobs without one aren\'t listed, but your report still helps.';
    }
  } catch (e) {
    preview.textContent = e.message || "We couldn't read that page.";
    $('desc-wrap').hidden = false;
  }
}
$('job-url').addEventListener('change', lookUp);
$('job-url').addEventListener('blur', lookUp);

// Arriving from a job page (?url=…) or from the Red Flag Detector (draft in this tab).
const params = new URLSearchParams(location.search);
let draft = null;
try {
  draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null');
  sessionStorage.removeItem(DRAFT_KEY);
} catch {
  // No draft.
}
const startUrl = params.get('url') || draft?.url || '';
if (draft?.text) {
  $('job-desc').value = draft.text.slice(0, 20000);
  $('job-title').value = draft.text.trim().split('\n')[0].replace(/\s*job application form.*$/i, '').slice(0, 200);
  $('desc-wrap').hidden = false;
  $('desc-wrap').querySelector('label').textContent = 'The job description you checked (we use it if the link can\'t be read).';
}
if (startUrl) {
  $('job-url').value = startUrl;
  lookUp();
}

// ---------- Send ----------
// Clear an old "add the company" nudge once they start fixing things.
$('report-form').addEventListener('input', () => {
  if ($('report-status').dataset.nudge) {
    $('report-status').textContent = 'Ready when you are.';
    delete $('report-status').dataset.nudge;
  }
});
const picked = (name) => [...document.querySelectorAll(`input[name=${name}]:checked`)].map((c) => c.value);

$('report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('report-status');
  const button = e.target.querySelector('button[type=submit]');
  if ($('website').value) return; // a bot

  await lookUp();
  const url = $('job-url').value.trim();
  const stage = picked('stage')[0];
  const description = $('job-desc').value.trim();
  if (!/^https?:\/\/\S+\.\S+/.test(url)) return say('Add the link to the job posting first.', $('job-url'));
  if (!job && description.length < 200) return say('We need the job text to rate it: paste the description in the box.', $('job-desc'));
  if (!job && (!$('job-title').value.trim() || !$('job-company').value.trim())) return say('Add the job title and company.', $('job-title').value.trim() ? $('job-company') : $('job-title'));
  if (!stage) return say('Pick how far you got.', document.querySelector('input[name=stage]'));

  const skipProcess = stage === 'applied';
  const upfront = $('salary-upfront').value;
  button.disabled = true;
  status.textContent = 'Sending…';
  try {
    const db = await supabase();
    const { error } = await db.rpc('submit_job_report', {
      p_reporter: reporterId(),
      p_job_url: url,
      p_job_id: listedId,
      p_title: job?.title ?? $('job-title').value.trim(),
      p_company: job?.company || $('job-company').value.trim(),
      p_description: job ? '' : description,
      p_stage: stage,
      p_steps: skipProcess ? [] : picked('steps'),
      p_rounds: skipProcess || !$('rounds').value ? null : Number($('rounds').value),
      p_duration: skipProcess ? null : $('duration').value || null,
      p_salary_upfront: upfront === '' ? null : upfront === 'yes',
      p_tags: picked('tags'),
    });
    if (error) throw error;
    track('interview_report', { report_stage: stage, report_new_job: !listedId });
    $('report-form').hidden = true;
    $('report-done').hidden = false;
    $('report-done').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    status.textContent = /slow down/i.test(err?.message ?? '')
      ? "That's a lot of reports from this browser today. Try again tomorrow."
      : "That didn't send. Check your connection and try again.";
  } finally {
    button.disabled = false;
  }

  function say(message, focus) {
    status.textContent = message;
    status.dataset.nudge = '1';
    focus?.focus();
  }
});
