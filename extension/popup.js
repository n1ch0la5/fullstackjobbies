import { rate } from './badge.js';

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
});
