// Homepage behaviour. The checker reuses the sifter's own rules and scoring
// (copied to /lib at build time), so a pasted job is rated exactly like the
// ones on the jobs page. Everything runs in the browser; nothing is sent anywhere.
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

export function rateText(text) {
  const firstLine = text.trim().split('\n')[0].slice(0, 140);
  const job = { source: 'paste', title: firstLine, description: text, location: '', remote: null, salary: null };
  const facts = extractFacts(job);
  return { facts, rating: scoreJob(facts) };
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
  return /^https?:\/\/\S+$/i.test(text.trim());
}

function renderResult(target, text, { compact = false } = {}) {
  target.replaceChildren();
  if (!text.trim()) {
    target.append(el('p', { class: 'result-empty', style: 'margin:0' }, 'Paste a job description first.'));
    return null;
  }
  if (looksLikeLink(text)) {
    target.append(el('p', { style: 'margin:0' }, "We can't open links yet. Copy the job description text from the page and paste that instead."));
    return null;
  }
  const { facts, rating } = rateText(text);
  const flags = [...facts.severeFlags, ...facts.redFlags];

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

// Red Flag Detector
const detectorForm = document.getElementById('detector-form');
const jd = document.getElementById('jd');
const detectorResult = document.getElementById('detector-result');
detectorForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  setupShare(renderResult(detectorResult, jd.value));
});

// Hero paste box: quick result inline, full breakdown waiting in the detector.
const heroForm = document.getElementById('hero-check');
const heroInput = document.getElementById('hero-input');
const heroResult = document.getElementById('hero-result');
heroForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  heroResult.replaceChildren();
  const box = el('div', { class: 'result hero-result' });
  heroResult.append(box);
  const res = renderResult(box, heroInput.value, { compact: true });
  if (res) {
    jd.value = heroInput.value;
    setupShare(renderResult(detectorResult, jd.value));
  }
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
