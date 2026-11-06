// Homepage behaviour. The checker reuses the sifter's own rules and scoring
// (copied to /lib at build time), so a pasted job is rated exactly like the
// ones on the jobs page. Pasted text is rated in the browser and never sent
// anywhere; a pasted link is read by our /api/read-job function first.
import { extractFacts } from '/lib/extract.js';
import { scoreJob } from '/lib/score.js';

const STYLE_LABELS = {
  live_algorithm: 'Live algorithm test',
  take_home: 'Take-home',
  paid_take_home: 'Paid take-home',
  unpaid_take_home: 'Unpaid take-home',
  pairing: 'Pair on real work',
  conversation: 'Just a conversation',
};

export function rateJob(job) {
  const facts = extractFacts(job);
  return { facts, rating: scoreJob(facts) };
}

// Custom events for Google Tag Manager (no personal data, never the pasted text).
export function track(event, params = {}) {
  (window.dataLayer = window.dataLayer || []).push({ event, ...params });
}

function jobFromText(text) {
  const firstLine = text.trim().split('\n')[0].slice(0, 140);
  return { source: 'paste', title: firstLine, description: text, location: '', remote: null, salary: null };
}

function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined) node.append(kid);
  return node;
}

function formatPay(s) {
  if (!s) return null;
  const sym = { USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$' }[s.currency] ?? `${s.currency} `;
  const f = (n) => (s.interval === 'hour' ? `${sym}${n}` : `${sym}${Math.round(n / 1000)}k`);
  const range = s.min === s.max ? f(s.min) : `${f(s.min)}–${f(s.max)}`;
  return s.interval === 'hour' ? `${range}/hr` : range;
}

function looksLikeLink(text) {
  return /^https?:\/\/\S+$/i.test(text.trim()) || /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(text.trim());
}

// Text → job right away. Link → ask our function to read the page, then rate it here.
async function jobFromInput(input) {
  const text = input.trim();
  if (!text) throw new Error('Paste a job link or description first.');
  if (!looksLikeLink(text)) return jobFromText(text);
  const link = /^https?:/i.test(text) ? text : `https://${text}`;
  let res;
  try {
    res = await fetch(`/api/read-job?url=${encodeURIComponent(link)}`);
  } catch {
    throw new Error("We couldn't reach our link reader. Check your connection, or paste the description text.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "We couldn't read that link. Paste the description text instead.");
  return { source: 'link', ...data };
}

function renderMessage(target, message) {
  target.replaceChildren(el('p', { style: 'margin:0' }, message));
}

function renderLoading(target) {
  target.replaceChildren(el('p', { class: 'result-empty', style: 'margin:0' }, '👃 Sniffing that link…'));
}

function renderResult(target, job, { compact = false } = {}) {
  const { facts, rating } = rateJob(job);
  const flags = [...facts.severeFlags, ...facts.redFlags];
  target.replaceChildren();

  if (job.source === 'link') {
    const what = [job.title, job.company].filter(Boolean).join(' at ');
    target.append(el('p', { class: 'mono', style: 'margin:0;font-size:12px;font-weight:700;color:var(--ink-3)' },
      `READ FROM THE LINK${what ? ` · ${what.toUpperCase()}` : ''}`));
  }

  target.append(
    el('div', { class: 'result-top' },
      el('span', { class: 'result-emoji', 'aria-hidden': 'true' }, rating.emoji),
      el('div', {},
        el('p', { class: 'mono', style: 'margin:0;font-size:13px;font-weight:700' }, 'THIS LISTING IS'),
        el('p', { class: 'result-name' }, rating.name),
      ),
    ),
  );

  const tags = el('div', { class: 'tags' });
  const pay = formatPay(facts.salary);
  tags.append(el('span', { class: `tag ${pay ? 'tag-pay' : 'tag-flag'}` }, pay ?? 'No salary'));
  if (facts.remote) tags.append(el('span', { class: 'tag tag-stack' }, 'Remote'));
  if (facts.rounds) tags.append(el('span', { class: 'tag tag-int' }, `${facts.rounds} rounds`));
  for (const s of facts.interviewStyles) tags.append(el('span', { class: 'tag tag-int' }, STYLE_LABELS[s] ?? s));
  for (const s of facts.stack.slice(0, 8)) tags.append(el('span', { class: 'tag tag-stack' }, s));
  target.append(tags);

  if (!compact) {
    target.append(
      el('p', { style: 'margin:0;font-weight:700' }, flags.length ? `${flags.length} red flag${flags.length === 1 ? '' : 's'}` : 'No red flags spotted'),
    );
    if (flags.length) target.append(el('ul', {}, flags.map((f) => el('li', {}, f))));
    target.append(el('p', { style: 'margin:0;font-weight:700' }, 'How we got there'));
    target.append(el('ul', {}, (rating.reasons.length ? rating.reasons : ['Nothing stood out either way']).map((r) => el('li', {}, r))));
  } else {
    const link = el('a', { href: '#detector', style: 'font-weight:700' }, 'See the full breakdown');
    target.append(el('p', { style: 'margin:0;font-size:15px' }, flags.length ? `${flags.length} red flag${flags.length === 1 ? '' : 's'}. ` : 'No red flags spotted. ', link));
  }
  return { facts, rating, flags };
}

function setupShare(res) {
  const row = document.getElementById('share-row');
  if (!res) { row.hidden = true; return; }
  const { rating, flags } = res;
  const url = 'https://fullstackjobbies.com/#detector';
  const line = `This job listing is a ${rating.name} ${rating.emoji} on the Jobbie Scale${flags.length ? ` (${flags.length} red flag${flags.length === 1 ? '' : 's'})` : ''}. Check yours:`;
  document.getElementById('share-x').href = `https://x.com/intent/post?text=${encodeURIComponent(line)}&url=${encodeURIComponent(url)}`;
  document.getElementById('share-li').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const copy = document.getElementById('share-copy');
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(`${line} ${url}`);
      copy.textContent = 'Copied!';
    } catch {
      copy.textContent = 'Copy failed';
    }
    setTimeout(() => (copy.textContent = 'Copy result'), 1800);
  };
  row.hidden = false;
}

async function withBusy(button, label, work) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try {
    return await work();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

// Red Flag Detector
const detectorForm = document.getElementById('detector-form');
const jd = document.getElementById('jd');
const detectorResult = document.getElementById('detector-result');
detectorForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const button = detectorForm.querySelector('button');
  withBusy(button, 'Sniffing…', async () => {
    if (looksLikeLink(jd.value)) renderLoading(detectorResult);
    try {
      const job = await jobFromInput(jd.value);
      const res = renderResult(detectorResult, job);
      setupShare(res);
      track('job_check', { check_from: 'detector', check_method: job.source, jobbie_rating: res.rating.name });
    } catch (err) {
      renderMessage(detectorResult, err.message);
      setupShare(null);
    }
  });
});

// Hero paste box: quick result inline, full breakdown waiting in the detector.
const heroForm = document.getElementById('hero-check');
const heroInput = document.getElementById('hero-input');
const heroResult = document.getElementById('hero-result');
heroForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const button = heroForm.querySelector('button');
  const box = el('div', { class: 'result hero-result' });
  heroResult.replaceChildren(box);
  withBusy(button, 'Sniffing…', async () => {
    if (looksLikeLink(heroInput.value)) renderLoading(box);
    try {
      const job = await jobFromInput(heroInput.value);
      const res = renderResult(box, job, { compact: true });
      track('job_check', { check_from: 'hero', check_method: job.source, jobbie_rating: res.rating.name });
      jd.value = heroInput.value;
      setupShare(renderResult(detectorResult, job));
    } catch (err) {
      renderMessage(box, err.message);
    }
  });
});
heroInput?.addEventListener('input', () => {
  heroInput.style.height = 'auto';
  heroInput.style.height = `${Math.min(heroInput.scrollHeight, 260)}px`;
});

// Rocket of the Week: fill from the sifter's picks when there are any.
(async () => {
  try {
    const res = await fetch('/data/best-jobbie-candidates.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const { jobs, updatedAt } = await res.json();
    const top = jobs?.[0];
    if (!top) return;
    document.getElementById('rocket-when').textContent = `WEEK OF ${new Date(updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}`;
    const title = document.getElementById('rocket-title');
    title.replaceChildren(el('a', { href: top.url, target: '_blank', rel: 'noopener' }, `${top.title} at ${top.company}`));
    document.getElementById('rocket-blurb').textContent = top.location || 'Salary up front, a sane process, and a stack worth working in.';
    const tags = document.getElementById('rocket-tags');
    tags.replaceChildren(
      ...[formatPay(top.salary), top.rounds ? `${top.rounds} rounds` : null, ...top.interviewStyles.map((s) => STYLE_LABELS[s] ?? s), top.remote ? 'Remote' : null]
        .filter(Boolean)
        .map((t) => el('span', { class: 'tag' }, t)),
    );
  } catch {
    // Keep the example card.
  }
})();

// Signups (the forms themselves are handled by Netlify Forms).
for (const form of document.querySelectorAll('form[data-netlify]')) {
  form.addEventListener('submit', () => track('sign_up', { form_name: form.getAttribute('name') }));
}
