// Copies what the static site needs into site/ before Netlify publishes it.
// Only public files go out: worst-jobbie candidates name real companies, so
// they stay private until someone anonymises one for the Friday post.
import { cp, mkdir, writeFile, access } from 'node:fs/promises';

const PUBLIC_DATA = ['jobs.json', 'best-jobbie-candidates.json', 'stats.json'];
const SHARED_CODE = ['extract.js', 'score.js'];

await mkdir('site/data', { recursive: true });
await mkdir('site/lib', { recursive: true });

for (const f of PUBLIC_DATA) {
  try {
    await access(`data/${f}`);
    await cp(`data/${f}`, `site/data/${f}`);
  } catch {
    // Before the first sift there is no data yet; ship an empty file so pages show their empty state.
    if (f === 'jobs.json') await writeFile('site/data/jobs.json', JSON.stringify({ updatedAt: null, count: 0, jobs: [] }));
  }
}
for (const f of SHARED_CODE) await cp(`src/${f}`, `site/lib/${f}`);

console.log('site/ ready');
