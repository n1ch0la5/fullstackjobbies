// Jobs page: loads the sifter's output and filters it in the browser.
import { COUNTRIES, REGIONS, jobFitsWhere, describeWhere } from '/lib/location.js';

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
const BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));
const STORE_KEY = 'fsj.where.v1';

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

// ---------- Where can you work? ----------
// Remembered per visitor (in their own browser) and mirrored into the URL so a search can be shared.
const where = { picked: [], anywhere: true, unstated: true };

function guessCountry() {
  for (const lang of navigator.languages ?? [navigator.language]) {
    const region = (lang || '').split('-')[1]?.toUpperCase();
    if (region && BY_CODE[region]) return [region];
  }
  return [];
}

function loadWhere() {
  const params = new URLSearchParams(location.search);
  if (params.has('where')) {
    where.picked = params.get('where').split(',').map((s) => s.trim().toUpperCase()).filter((c) => BY_CODE[c]);
    if (params.get('anywhere') === '0') where.anywhere = false;
    if (params.get('unstated') === '0') where.unstated = false;
    return;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (saved) {
      where.picked = (saved.picked ?? []).filter((c) => BY_CODE[c]);
      where.anywhere = saved.anywhere !== false;
      where.unstated = saved.unstated !== false;
      return;
    }
  } catch {
    // Storage blocked; fall through to a guess.
  }
  where.picked = guessCountry();
}

function saveWhere() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(where));
  } catch {
    // Fine: the filter still works for this visit.
  }
  const params = new URLSearchParams(location.search);
  params.delete('where'); params.delete('anywhere'); params.delete('unstated');
  if (where.picked.length) {
    params.set('where', where.picked.join(','));
    if (!where.anywhere) params.set('anywhere', '0');
    if (!where.unstated) params.set('unstated', '0');
  }
  const qs = params.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function drawWherePicker() {
  const chips = $('where-chips');
  chips.replaceChildren(
    ...(where.picked.length
      ? where.picked.map((code) =>
          el('button', { type: 'button', class: 'where-chip', 'data-code': code, 'aria-label': `Remove ${BY_CODE[code].name}` },
            `${BY_CODE[code].flag} ${BY_CODE[code].name}`, el('span', { 'aria-hidden': 'true' }, '✕')))
      : [el('span', { class: 'where-empty' }, 'Anywhere. Pick countries to narrow it down.')]),
  );

  const select = $('add-country');
  const groups = Object.entries(REGIONS).map(([r, label]) =>
    el('optgroup', { label },
      COUNTRIES.filter((c) => c.region === r && !where.picked.includes(c.code))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => el('option', { value: c.code }, `${c.flag} ${c.name}`))),
  );
  select.replaceChildren(el('option', { value: '' }, where.picked.length ? '+ Add another country' : '+ Add a country'), ...groups);

  $('inc-anywhere').checked = where.anywhere;
  $('inc-unstated').checked = where.unstated;
  $('inc-anywhere').disabled = $('inc-unstated').disabled = !where.picked.length;

  const current = where.picked.join(',');
  for (const b of document.querySelectorAll('.preset')) b.setAttribute('aria-pressed', String(b.dataset.preset === current));
}

function setPicked(codes) {
  where.picked = [...new Set(codes)].filter((c) => BY_CODE[c]);
  saveWhere();
  drawWherePicker();
  render();
}

$('where-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.where-chip');
  if (chip) setPicked(where.picked.filter((c) => c !== chip.dataset.code));
});
$('add-country').addEventListener('change', (e) => {
  if (e.target.value) setPicked([...where.picked, e.target.value]);
});
for (const b of document.querySelectorAll('.preset')) {
  b.addEventListener('click', () => setPicked(b.dataset.preset ? b.dataset.preset.split(',') : []));
}
for (const id of ['inc-anywhere', 'inc-unstated']) {
  $(id).addEventListener('change', () => {
    where.anywhere = $('inc-anywhere').checked;
    where.unstated = $('inc-unstated').checked;
    saveWhere();
    render();
  });
}

// ---------- Job cards ----------
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
  const whereText = describeWhere(j.where);
  return el('article', { class: 'job' },
    el('div', { class: 'job-main' },
      el('h3', {}, j.title),
      el('p', { class: 'co' }, [j.company, j.location].filter(Boolean).join(' · ')),
      el('div', { class: 'tags' },
        el('span', { class: 'tag tag-pay' }, formatPay(j.salary)),
        whereText && el('span', { class: 'tag where-tag' }, whereText),
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
    if (!jobFitsWhere(j.where, where.picked, { includeAnywhere: where.anywhere, includeUnstated: where.unstated })) return false;
    if (q) {
      const hay = `${j.title} ${j.company} ${j.location} ${j.stack.join(' ')}`.toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });

  const placeNote = where.picked.length ? ` you can work from ${where.picked.map((c) => BY_CODE[c].flag).join(' ')}` : '';
  $('count').textContent = `${shown.length} of ${allJobs.length} jobs${placeNote}`;
  const list = $('jobs');
  list.replaceChildren(...shown.map(jobCard));
  if (!shown.length) {
    list.append(
      el('div', { class: 'empty' },
        el('p', { style: 'font-size:48px;margin:0' }, '🔍'),
        el('p', { style: 'font-weight:700;font-size:20px;margin:8px 0 0' }, allJobs.length ? 'Nothing matches those filters.' : 'The first sift hasn\'t landed yet.'),
        el('p', { style: 'margin:6px 0 0;color:var(--ink-2)' }, allJobs.length ? 'Try adding a country or loosening the rating.' : 'Fresh jobs arrive every morning. Check back tomorrow.'),
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

for (const id of ['q', 'min', 'remote']) $(id).addEventListener('input', render);
for (const box of document.querySelectorAll('input[name=hide]')) box.addEventListener('input', render);

loadWhere();
drawWherePicker();

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
