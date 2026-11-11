// The preview image for one job's page (1200×630 PNG): title, company, rating badge, pay.
// Shown when someone shares the job on X, LinkedIn, Slack, iMessage…
// Built at deploy time with satori (layout → SVG) and resvg (SVG → PNG); no browser needed.
import { readFile } from 'node:fs/promises';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { formatPay, LEVEL_BG, LEVEL_FG } from './job-page-template.js';

const INK = '#1A1712';
const BUTTER = '#FFF4CC';
const font = (pkg, file) => readFile(new URL(`../node_modules/@fontsource/${pkg}/files/${file}`, import.meta.url));

let assets;
async function load() {
  assets ??= (async () => ({
    fonts: [
      { name: 'Bricolage', data: await font('bricolage-grotesque', 'bricolage-grotesque-latin-800-normal.woff'), weight: 800, style: 'normal' },
      { name: 'Inter', data: await font('inter', 'inter-latin-500-normal.woff'), weight: 500, style: 'normal' },
      { name: 'Inter', data: await font('inter', 'inter-latin-600-normal.woff'), weight: 600, style: 'normal' },
    ],
    // Noto Emoji (Apache 2.0), one per Jobbie Scale level: see assets/og/NOTICE.txt.
    emoji: await Promise.all(
      [0, 1, 2, 3, 4, 5].map(async (lv) => `data:image/png;base64,${(await readFile(new URL(`../assets/og/level-${lv}.png`, import.meta.url))).toString('base64')}`),
    ),
  }))();
  return assets;
}

// A tiny hyperscript so the layout reads like HTML without a JSX build step.
const h = (type, style, ...children) => ({ type, props: { style, children: children.flat().filter((c) => c !== null && c !== false && c !== undefined) } });

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export async function renderOgImage(job, where) {
  const { fonts, emoji } = await load();
  const lv = job.rating.level;
  const pay = formatPay(job.salary);
  const title = clip(job.title, 80);
  const titleSize = title.length > 56 ? 54 : title.length > 34 ? 64 : 76;
  const sub = clip([job.company, where || job.location].filter(Boolean).join(' · '), 70);
  const flags = job.redFlags?.length ?? 0;

  const tree = h('div', { width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 64px', background: BUTTER, color: INK, fontFamily: 'Inter', border: `12px solid ${INK}` },
    h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
      h('div', { display: 'flex', fontFamily: 'Bricolage', fontWeight: 800, fontSize: 36 },
        h('span', {}, 'fullstack'), h('span', { color: '#8A5523' }, 'jobbies')),
      h('div', { display: 'flex', fontSize: 24, fontWeight: 500, color: '#5E564A' }, 'Rated on the Jobbie Scale')),
    h('div', { display: 'flex', flexDirection: 'column' },
      h('div', { display: 'flex', fontFamily: 'Bricolage', fontWeight: 800, fontSize: titleSize, lineHeight: 1.05, letterSpacing: -1.5 }, title),
      h('div', { display: 'flex', marginTop: 18, fontSize: 32, fontWeight: 600, color: '#3B352C' }, sub)),
    h('div', { display: 'flex', alignItems: 'center', gap: 20 },
      h('div', { display: 'flex', alignItems: 'center', gap: 16, padding: '12px 30px 12px 18px', borderRadius: 999, border: `4px solid ${INK}`, background: LEVEL_BG[lv], color: LEVEL_FG[lv], boxShadow: `6px 6px 0 ${INK}` },
        { type: 'img', props: { src: emoji[lv], width: 60, height: 60, style: { width: 60, height: 60 } } },
        h('div', { display: 'flex', fontFamily: 'Bricolage', fontWeight: 800, fontSize: 46 }, job.rating.name)),
      pay && h('div', { display: 'flex', padding: '14px 26px', borderRadius: 999, border: `4px solid ${INK}`, background: '#FFFFFF', fontSize: 36, fontWeight: 600 }, pay),
      flags > 0 && h('div', { display: 'flex', fontSize: 28, fontWeight: 600, color: '#8A2E1F' }, `${flags} red flag${flags === 1 ? '' : 's'}`)),
  );
  const svg = await satori(tree, { width: 1200, height: 630, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
