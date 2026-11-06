import { rate } from './badge.js';
import { loadPrefs, hasPrefs, fitCheck } from './prefs.js';

const prefs = await loadPrefs();
document.getElementById('prefs').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
document.getElementById('prefs').textContent = hasPrefs(prefs) ? 'Your preferences' : 'Set your preferences';

const out = document.getElementById('out');
const text = document.getElementById('text');

document.getElementById('go').addEventListener('click', () => {
  out.replaceChildren();
  const value = text.value.trim();
  if (!value) {
    out.append(Object.assign(document.createElement('p'), { textContent: 'Paste a job description first.' }));
    return;
  }
  const { facts, rating } = rate({ title: value.split('\n')[0].slice(0, 140), text: value });
  const flags = [...facts.severeFlags, ...facts.redFlags];
  const big = Object.assign(document.createElement('div'), { className: 'big', textContent: `${rating.emoji} ${rating.name}` });
  const summary = Object.assign(document.createElement('p'), {
    textContent: flags.length ? `${flags.length} red flag${flags.length === 1 ? '' : 's'}: ${flags.join(', ')}` : 'No red flags spotted.',
  });
  const ul = document.createElement('ul');
  for (const r of rating.reasons) ul.append(Object.assign(document.createElement('li'), { textContent: r }));
  out.append(big, summary, ul);
  if (hasPrefs(prefs)) {
    const { fits, heads } = fitCheck(facts, { text: value }, prefs);
    if (fits.length) out.append(Object.assign(document.createElement('p'), { textContent: `✅ Fits you: ${fits.join(' · ')}` }));
    for (const h of heads) out.append(Object.assign(document.createElement('p'), { textContent: `⚠️ ${h}` }));
  }
});
