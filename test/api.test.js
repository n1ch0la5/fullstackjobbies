import { test } from 'node:test';
import assert from 'node:assert/strict';

const JOBS = {
  updatedAt: '2026-11-06T10:00:00Z',
  jobs: [
    { id: 'gh:a:1', slug: 'a-full-stack-1', title: 'Full Stack Engineer', company: 'A', location: 'Remote (US)', where: { countries: ['US'], regions: [], anywhere: false }, remote: true, salary: { min: 170000, max: 200000, currency: 'USD', interval: 'year' }, stack: ['react', 'node'], rounds: 2, interviewStyles: ['pairing'], redFlags: [], rating: { level: 5, name: 'Rocket ship', emoji: '🚀', reasons: ['+1.5 top-band pay'] }, url: 'https://a.test/apply', firstSeen: '2026-11-06' },
    { id: 'gh:b:2', slug: 'b-full-stack-2', title: 'Fullstack Dev', company: 'B', location: 'Berlin', where: { countries: ['DE'], regions: [], anywhere: false }, remote: false, salary: { min: 70000, max: 80000, currency: 'EUR', interval: 'year' }, stack: ['vue', 'rails'], rounds: 6, interviewStyles: ['live_algorithm'], redFlags: ['rockstar'], rating: { level: 1, name: 'Steaming pile', emoji: '💩', reasons: [] }, url: 'https://b.test/apply', firstSeen: '2026-11-05' },
  ],
};

globalThis.fetch = async (u) => {
  if (String(u).endsWith('/data/jobs.json')) return new Response(JSON.stringify(JOBS), { headers: { 'content-type': 'application/json' } });
  return new Response('nope', { status: 404 });
};

const { searchJobs, rateInput } = await import('../src/api.js');
const { default: api } = await import('../netlify/functions/api.mjs');
const { default: mcp } = await import('../netlify/functions/mcp.mjs');

test('search filters like the jobs page', () => {
  const s = (p) => searchJobs(JOBS.jobs, p, { siteUrl: 'https://x.test' });
  assert.equal(s({}).total, 2);
  assert.equal(s({ where: 'US,CA' }).jobs[0].company, 'A');
  assert.equal(s({ where: ['DE'] }).total, 1);
  assert.equal(s({ min_rating: '4' }).total, 1);
  assert.equal(s({ hide_interview_styles: 'live_algorithm' }).total, 1);
  assert.equal(s({ stack: 'react,node' }).total, 1);
  assert.equal(s({ salary_min_usd: 150000 }).total, 1);
  assert.equal(s({}).jobs[0].page_url, 'https://x.test/job/a-full-stack-1');
});

test('rate pasted text', async () => {
  const r = await rateInput({ text: 'Full stack rockstar ninja. Competitive salary. 7 rounds.' });
  assert.equal(r.rating.name, 'Steaming pile');
  assert.ok(r.red_flags.includes('rockstar'));
  await assert.rejects(rateInput({}), /Send "text"/);
});

test('HTTP API', async () => {
  const res = await api(new Request('https://x.test/api/jobs?where=US&limit=5'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.total, 1);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  const rated = await api(new Request('https://x.test/api/rate', { method: 'POST', body: JSON.stringify({ text: '$190k-$220k, remote, React and Node, 2 rounds, pair on a real task' }) }));
  assert.equal((await rated.json()).rating.name, 'Rocket ship');
  const li = await api(new Request('https://x.test/api/rate?url=' + encodeURIComponent('https://www.linkedin.com/jobs/view/1')));
  assert.equal(li.status, 422);
});

async function rpc(body) {
  const res = await mcp(new Request('https://x.test/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }));
  return { status: res.status, body: res.status === 202 ? null : await res.json() };
}

test('MCP handshake, tools and calls', async () => {
  const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  assert.equal(init.body.result.protocolVersion, '2025-06-18');
  assert.ok(init.body.result.capabilities.tools);
  assert.equal((await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
  const tools = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(tools.body.result.tools.map((t) => t.name), ['search_jobs', 'rate_job']);
  const found = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search_jobs', arguments: { where: ['US'], min_rating: 4 } } });
  assert.equal(found.body.result.structuredContent.jobs[0].title, 'Full Stack Engineer');
  const bad = await rpc({ jsonrpc: '2.0', id: 4, method: 'nope' });
  assert.equal(bad.body.error.code, -32601);
  const get = await mcp(new Request('https://x.test/mcp'));
  assert.equal(get.status, 405);
});
