// End-to-end run with the network stubbed out: proves discovery, filtering,
// scoring and the salary rule work together.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DRY_RUN = '1';
delete process.env.ANTHROPIC_API_KEY;

const FAKE = {
  'hn.algolia.com/api/v1/search_by_date': { hits: [{ objectID: '1', title: 'Ask HN: Who is hiring? (November 2026)' }] },
  'hn.algolia.com/api/v1/items/1': {
    children: [
      { id: 11, created_at: '2026-11-02', text: 'Widgetco | Full Stack Engineer | Remote | $170k-$200k<p>React, Node, Postgres. 2 rounds, no leetcode. Apply: https://boards.greenhouse.io/widgetco' },
      { id: 12, created_at: '2026-11-02', text: 'Hypeco | Full-stack Rockstar Ninja | NYC<p>Fast-paced family. Competitive salary. Unpaid trial week.' },
      { id: 13, created_at: '2026-11-02', text: 'Dataco | Data Engineer | Remote | $150k' },
    ],
  },
  'boards-api.greenhouse.io/v1/boards/widgetco': {
    jobs: [
      { id: 1, title: 'Full Stack Engineer', absolute_url: 'https://boards.greenhouse.io/widgetco/jobs/1', location: { name: 'Remote' }, content: '&lt;p&gt;$150,000 - $175,000. Vue and Rails.&lt;/p&gt;' },
      { id: 2, title: 'Designer', absolute_url: 'https://boards.greenhouse.io/widgetco/jobs/2', location: { name: 'Remote' }, content: '' },
    ],
  },
};

globalThis.fetch = async (url) => {
  const key = Object.keys(FAKE).find((k) => String(url).includes(k));
  if (!key) return new Response('nope', { status: 404 });
  return new Response(JSON.stringify(FAKE[key]), { status: 200, headers: { 'content-type': 'application/json' } });
};

test('a full sift run', async () => {
  const { sift } = await import('../src/run.js');
  const { listed, worst, stats } = await sift();

  assert.ok(stats.newBoards >= 1, 'discovers widgetco from the HN post');
  const titles = listed.map((j) => `${j.company}: ${j.title}`);
  assert.ok(titles.includes('Widgetco: Full Stack Engineer'));
  assert.ok(listed.every((j) => j.salary), 'nothing without a salary is listed');
  assert.ok(!titles.some((t) => t.startsWith('Hypeco')), 'no-salary hype job is not listed');
  assert.ok(!titles.some((t) => t.startsWith('Dataco')), 'non full stack job is not listed');
  assert.equal(listed[0].rating.name, 'Rocket ship');
  assert.equal(worst[0].company, 'Hypeco');
  assert.equal(worst[0].rating.name, 'Bloody awful');
});
