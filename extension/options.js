import { loadPrefs, savePrefs, WORK_STYLES, AVOIDABLE, CURRENCIES } from './prefs.js';
import { COUNTRIES, REGIONS } from './lib/location.js';

const $ = (id) => document.getElementById(id);
let prefs = await loadPrefs();

function checkbox(name, value, label, checked) {
  const wrap = document.createElement('label');
  wrap.className = 'opt';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.name = name;
  box.value = value;
  box.checked = checked;
  wrap.append(box, ` ${label}`);
  return wrap;
}

function draw() {
  $('workStyles').replaceChildren(...Object.entries(WORK_STYLES).map(([v, l]) => checkbox('workStyles', v, l, prefs.workStyles.includes(v))));
  $('avoid').replaceChildren(...Object.entries(AVOIDABLE).map(([v, l]) => checkbox('avoid', v, l, prefs.avoid.includes(v))));
  $('floor').value = prefs.salaryFloor.amount || 0;
  $('currency').replaceChildren(...CURRENCIES.map((c) => Object.assign(document.createElement('option'), { value: c, textContent: c, selected: c === prefs.salaryFloor.currency })));
  $('startCollapsed').checked = prefs.startCollapsed;
  $('regions').replaceChildren(
    ...Object.entries(REGIONS).map(([r, label]) => {
      const box = document.createElement('div');
      box.className = 'region';
      const h = document.createElement('h3');
      h.textContent = label;
      const grid = document.createElement('div');
      grid.className = 'grid';
      for (const c of COUNTRIES.filter((x) => x.region === r).sort((a, b) => a.name.localeCompare(b.name))) {
        const l = document.createElement('label');
        const i = Object.assign(document.createElement('input'), { type: 'checkbox', name: 'countries', value: c.code, checked: prefs.countries.includes(c.code) });
        l.append(i, ` ${c.flag} ${c.name}`);
        grid.append(l);
      }
      box.append(h, grid);
      return box;
    }),
  );
  $('countryList').querySelector('summary').textContent = prefs.countries.length
    ? `Picked: ${prefs.countries.map((c) => COUNTRIES.find((x) => x.code === c)?.flag ?? c).join(' ')} (change)`
    : 'Pick countries';
}

let timer;
async function save() {
  const picked = (name) => [...document.querySelectorAll(`input[name=${name}]:checked`)].map((i) => i.value);
  prefs = {
    workStyles: picked('workStyles'),
    salaryFloor: { amount: Math.max(0, Number($('floor').value) || 0), currency: $('currency').value },
    countries: picked('countries'),
    avoid: picked('avoid'),
    startCollapsed: $('startCollapsed').checked,
  };
  await savePrefs(prefs);
  $('countryList').querySelector('summary').textContent = prefs.countries.length
    ? `Picked: ${prefs.countries.map((c) => COUNTRIES.find((x) => x.code === c)?.flag ?? c).join(' ')} (change)`
    : 'Pick countries';
  $('status').classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => $('status').classList.remove('show'), 1200);
}

document.addEventListener('change', save);
for (const b of document.querySelectorAll('[data-pick]')) {
  b.addEventListener('click', async () => {
    const codes = b.dataset.pick ? b.dataset.pick.split(',') : [];
    for (const i of document.querySelectorAll('input[name=countries]')) i.checked = codes.includes(i.value);
    await save();
  });
}

draw();
