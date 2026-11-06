// The rating badge shown on job pages. Same rules and scoring as the website.
// Lives in a shadow root so the page's styles can't break it (and ours can't break the page).
import { extractFacts } from './lib/extract.js';
import { scoreJob } from './lib/score.js';
import { loadPrefs, hasPrefs, fitCheck } from './prefs.js';

const BG = ['#5C1A1A', '#8A5523', '#C9893E', '#E9D16A', '#7FB3FF', '#2F5BFF'];
const FG = ['#FFF4CC', '#FFF4CC', '#1A1712', '#1A1712', '#1A1712', '#FFFFFF'];
const STYLE_LABELS = {
  live_algorithm: 'Live algorithm test',
  take_home: 'Take-home',
  paid_take_home: 'Paid take-home',
  unpaid_take_home: 'Unpaid take-home',
  pairing: 'Pair on real work',
  conversation: 'Just a conversation',
};

// salary/remote come straight from a page's structured data when it has them,
// so a salary in a sidebar or in data never depends on being found in the prose.
export function rate({ title = '', text = '', location = '', salary = null, remote = null }) {
  const job = { source: 'page', title, description: text, location, remote, salary };
  const facts = extractFacts(job);
  return { facts, rating: scoreJob(facts) };
}

function formatPay(s) {
  if (!s) return null;
  const sym = { USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$' }[s.currency] ?? `${s.currency} `;
  const f = (n) => (s.interval === 'hour' ? `${sym}${n}` : `${sym}${Math.round(n / 1000)}k`);
  const range = s.min === s.max ? f(s.min) : `${f(s.min)}–${f(s.max)}`;
  return s.interval === 'hour' ? `${range}/hr` : range;
}

const CSS = `
:host { all: initial; }
.card { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 320px; max-width: calc(100vw - 32px);
  font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: #1A1712;
  background: #FFF4CC; border: 3px solid #1A1712; border-radius: 16px; box-shadow: 6px 6px 0 #1A1712; overflow: hidden; }
.head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; }
.emoji { font-size: 34px; line-height: 1; }
.label { font: 700 11px/1 ui-monospace, monospace; letter-spacing: .06em; text-transform: uppercase; color: #5C5444; }
.name { font-weight: 800; font-size: 20px; letter-spacing: -0.01em; }
.grow { flex: 1; min-width: 0; }
button { all: unset; cursor: pointer; width: 28px; height: 28px; display: grid; place-items: center; border: 2px solid #1A1712; border-radius: 8px; background: #fff; font-weight: 700; }
button:focus-visible { outline: 3px solid #2F5BFF; outline-offset: 2px; }
.body { padding: 0 14px 12px; display: grid; gap: 8px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font: 500 12px ui-monospace, monospace; border: 2px solid #1A1712; border-radius: 7px; padding: 2px 7px; background: #fff; }
.tag.pay { background: #E6F7E9; } .tag.flag { background: #FFD9C7; }
ul { margin: 0; padding-left: 18px; }
.fit { border: 2px solid #1A1712; border-radius: 10px; background: #fff; padding: 8px 10px; display: grid; gap: 4px; }
.fit p { margin: 0; font-size: 13px; }
.fit .ok::before { content: "✅ "; } .fit .warn::before { content: "⚠️ "; }
.fit .k { font: 700 11px/1 ui-monospace, monospace; letter-spacing: .06em; text-transform: uppercase; color: #5C5444; margin-bottom: 2px; }
.prefs { all: unset; cursor: pointer; text-decoration: underline; color: #1A1712; width: auto; height: auto; border: 0; background: none; font: inherit; display: inline; }
.foot { font-size: 12px; color: #5C5444; border-top: 2px dashed #D8CFB4; padding: 8px 14px; }
.foot a { color: #1A1712; }
.collapsed .body, .collapsed .foot { display: none; }
`;

// Pages built with React, Remix or Next take over the whole document right after
// loading ("hydration") and delete anything an extension added before they finished.
// Greenhouse's job pages do this. So for the first 30 seconds the card puts itself
// back if the page removes it, unless the person closed it.
function keepAlive(host) {
  let reattaches = 0;
  const watcher = new MutationObserver(() => {
    if (host.isConnected || host.dataset.closed === '1') return;
    if (++reattaches > 25) return watcher.disconnect();
    document.documentElement.append(host);
  });
  watcher.observe(document, { childList: true, subtree: true });
  setTimeout(() => watcher.disconnect(), 30000);
  return () => watcher.disconnect();
}

export async function showBadge(input, { from = 'page' } = {}) {
  const prefs = await loadPrefs();
  const old = document.getElementById('fsj-badge-host');
  if (old) {
    old.dataset.closed = '1';
    old.remove();
  }
  const { facts, rating } = rate(input);
  const flags = [...facts.severeFlags, ...facts.redFlags];
  const host = document.createElement('div');
  host.id = 'fsj-badge-host';
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = CSS;
  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'complementary');
  card.setAttribute('aria-label', `Full Stack Jobbies rating: ${rating.name}`);

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  const head = el('div', 'head');
  const emoji = el('span', 'emoji', rating.emoji);
  emoji.setAttribute('aria-hidden', 'true');
  const titleBox = el('div', 'grow');
  titleBox.append(el('div', 'label', from === 'selection' ? 'Your selection is' : 'This listing is'), el('div', 'name', rating.name));
  const toggle = el('button', '', '–');
  toggle.title = 'Collapse';
  toggle.setAttribute('aria-label', 'Collapse');
  toggle.addEventListener('click', () => {
    const c = card.classList.toggle('collapsed');
    toggle.textContent = c ? '+' : '–';
    toggle.setAttribute('aria-label', c ? 'Expand' : 'Collapse');
  });
  const close = el('button', '', '✕');
  close.setAttribute('aria-label', 'Close');
  close.addEventListener('click', () => {
    host.dataset.closed = '1';
    stopWatching?.();
    host.remove();
  });
  head.append(emoji, titleBox, toggle, close);
  emoji.style.cssText = `background:${BG[rating.level]};color:${FG[rating.level]};border-radius:10px;padding:4px`;

  const body = el('div', 'body');

  // Your fit, from your preferences. The rating above is the same for everyone.
  if (hasPrefs(prefs)) {
    const { fits, heads } = fitCheck(facts, input, prefs);
    if (fits.length || heads.length) {
      const box = el('div', 'fit');
      box.append(el('div', 'k', 'For you'));
      if (fits.length) box.append(el('p', 'ok', `Fits you: ${fits.join(' · ')}`));
      for (const h of heads) box.append(el('p', 'warn', h));
      body.append(box);
    }
  }

  const tags = el('div', 'tags');
  const pay = formatPay(facts.salary);
  tags.append(el('span', `tag ${pay ? 'pay' : 'flag'}`, pay ?? 'No salary'));
  if (facts.workStyle) tags.append(el('span', 'tag', { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' }[facts.workStyle]));
  else if (facts.remote) tags.append(el('span', 'tag', 'Remote'));
  if (facts.rounds) tags.append(el('span', 'tag', `${facts.rounds} rounds`));
  for (const s of facts.interviewStyles) tags.append(el('span', 'tag', STYLE_LABELS[s] ?? s));
  body.append(tags);
  body.append(el('strong', '', flags.length ? `${flags.length} red flag${flags.length === 1 ? '' : 's'}` : 'No red flags spotted'));
  if (flags.length) {
    const ul = el('ul');
    for (const f of flags.slice(0, 6)) ul.append(el('li', '', f));
    body.append(ul);
  }
  const why = el('ul');
  for (const r of rating.reasons.slice(0, 6)) why.append(el('li', '', r));
  if (rating.reasons.length) body.append(el('strong', '', 'Why'), why);

  const foot = el('div', 'foot');
  const link = el('a', '', 'Full Stack Jobbies');
  link.href = 'https://fullstackjobbies.com/?ref=extension';
  link.target = '_blank';
  link.rel = 'noopener';
  const prefsLink = el('button', 'prefs', hasPrefs(prefs) ? 'Your preferences' : 'Set your preferences');
  prefsLink.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'open-options' }));
  foot.append('Sniffed by ', link, '. Nothing left your browser. ', prefsLink);

  card.append(head, body, foot);
  if (prefs.startCollapsed) {
    card.classList.add('collapsed');
    toggle.textContent = '+';
    toggle.setAttribute('aria-label', 'Expand');
  }
  root.append(style, card);
  document.documentElement.append(host);
  const stopWatching = keepAlive(host);
  return { facts, rating };
}
