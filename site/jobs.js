// Jobs page: loads the sifter's output and filters it in the browser.
const STYLE_LABELS = {
  live_algorithm: 'Live algorithm test',
  take_home: 'Take-home',
  paid_take_home: 'Paid take-home',
  unpaid_take_home: 'Unpaid take-home',
  pairing: 'Pair on real work',
  conversation: 'Just a conversation',
};
const LEVEL_BG = ['var(--l0)', 'var(--l1)', 'var(--l2)', 'var(--l3)', 'var(--l4)', 'var(--l5)'];
const LEVEL_FG = ['var(--butter)', 'var(--butter)', 'var(--ink)', 'var(--ink)', 'var(--ink)', '#fff'];

const $ = (id) => document.getElementById(id);
let allJobs = [];

function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) node.append(kid);
  return node;
}

function formatPay(s) {
  if (!s) return null;
  const sym = { USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$' }[s.currency] ?? `${s.currency} `;
  const f = (n) => (s.interval === 'hour' ? `${sym}${n}` : `${sym}${Math.round(n / 1000)}k`);
  const range = s.min === s.max ? f(s.min) : `${f(s.min)}–${f(s.max)}`;
  return s.interval === 'hour' ? `${range}/hr` : range;
}

function daysAgo(d) {
  if (!d) return null;
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (Number.isNaN(days)) return null;
  return days <= 0 ? 'New today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}

function jobCard(j) {
  const lv = j.rating.level;
  return el('article', { class: 'job' },
    el('div', { class: 'job-main' },
      el('h3', {}, j.title),
      el('p', { class: 'co' }, [j.company, j.location].filter(Boolean).join(' · ')),
      el('div', { class: 'tags' },
        el('span', { class: 'tag tag-pay' }, formatPay(j.salary)),
        j.remote && el('span', { class: 'tag tag-stack' }, 'Remote'),
        j.rounds && el('span', { class: 'tag tag-int' }, `${j.rounds} rounds`),
        j.interviewStyles.map((s) => el('span', { class: 'tag tag-int' }, STYLE_LABELS[s] ?? s)),
        j.stack.slice(0, 6).map((s) => el('span', { class: 'tag tag-stack' }, s)),
        j.redFlags.length > 0 && el('span', { class: 'tag tag-flag' }, `${j.redFlags.length} red flag${j.redFlags.length === 1 ? '' : 's'}`),
      ),
    ),
    el('div', { class: 'job-side' },
      el('span', { class: 'badge job-rating', style: `background:${LEVEL_BG[lv]};color:${LEVEL_FG[lv]};font-size:16px;padding:6px 14px` }, `${j.rating.name} ${j.rating.emoji}`),
      el('a', { class: 'btn btn-accent', href: j.url, target: '_blank', rel: 'noopener', style: 'padding:12px 18px;font-size:15px;box-shadow:4px 4px 0 var(--ink)' }, 'Apply on their site'),
      el('details', {},
        el('summary', {}, 'Why this rating'),
        el('ul', {}, [...j.rating.reasons, ...j.redFlags.map((f) => `red flag: ${f}`)].map((r) => el('li', {}, r))),
      ),
      el('span', { style: 'font-size:13px;color:var(--ink-3)' }, daysAgo(j.firstSeen)),
    ),
  );
}

function render() {
  const q = $('q').value.trim().toLowerCase();
  const min = Number($('min').value);
  const hide = [...document.querySelectorAll('input[name=hide]:checked')].map((c) => c.value);
  const remoteOnly = $('remote').checked;

  const shown = allJobs.filter((j) => {
    if (j.rating.level < min) return false;
    if (remoteOnly && !j.remote) return false;
    if (hide.some((h) => j.interviewStyles.includes(h))) return false;
    if (q) {
      const hay = `${j.title} ${j.company} ${j.location} ${j.stack.join(' ')}`.toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });

  $('count').textContent = `${shown.length} of ${allJobs.length} jobs`;
  const list = $('jobs');
  list.replaceChildren(...shown.map(jobCard));
  if (!shown.length) {
    list.append(
      el('div', { class: 'empty' },
        el('p', { style: 'font-size:48px;margin:0' }, '🔍'),
        el('p', { style: 'font-weight:700;font-size:20px;margin:8px 0 0' }, allJobs.length ? 'Nothing matches those filters.' : 'The first sift hasn\'t landed yet.'),
        el('p', { style: 'margin:6px 0 0;color:var(--ink-2)' }, allJobs.length ? 'Try loosening the rating or search.' : 'Fresh jobs arrive every morning. Check back tomorrow.'),
      ),
    );
  }
}

// Pre-tick filters from links like /jobs.html?hide=live_algorithm
const params = new URLSearchParams(location.search);
for (const h of params.getAll('hide')) {
  const box = document.querySelector(`input[name=hide][value="${CSS.escape(h)}"]`);
  if (box) box.checked = true;
}

$('filters').addEventListener('input', render);

try {
  const res = await fetch('/data/jobs.json', { cache: 'no-cache' });
  if (res.ok) {
    const data = await res.json();
    allJobs = data.jobs ?? [];
    if (data.updatedAt) $('updated').textContent = `Sifted ${new Date(data.updatedAt).toLocaleString()}`;
  }
} catch {
  // Leave the list empty; render() shows the friendly empty state.
}
render();
