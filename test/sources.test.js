import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prettifySlug, needsName } from '../src/names.js';
import { findBoards } from '../src/sources/hn.js';

test('company names from slugs', () => {
  assert.equal(prettifySlug('duck-duck-go'), 'DuckDuckGo');
  assert.equal(prettifySlug('proxima-fusion'), 'Proxima Fusion');
  assert.equal(prettifySlug('charge_robotics'), 'Charge Robotics');
  assert.equal(prettifySlug('getduranta'), 'Duranta');
  assert.equal(prettifySlug('acme-ai'), 'Acme AI');
  assert.equal(prettifySlug('reducto'), 'Reducto');
  assert.ok(needsName({ slug: 'reducto', name: 'reducto' }));
  assert.ok(!needsName({ slug: 'gitlab', name: 'GitLab' }));
});

test('HN links reveal boards on more hiring systems', () => {
  const html = 'Apply at https://acme.recruitee.com/o/full-stack or https://jobs.smartrecruiters.com/WidgetCo/123 or https://apply.workable.com/foo-bar/j/ABC123/';
  assert.deepEqual(findBoards(html), [
    { ats: 'recruitee', slug: 'acme' },
    { ats: 'smartrecruiters', slug: 'WidgetCo' },
    { ats: 'workable', slug: 'foo-bar' },
  ]);
});

test('Remote OK jobs carry their required credit', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([
    { last_updated: 1, legal: 'terms' },
    { id: '42', position: 'Full Stack Engineer', company: 'Widgetco', location: 'US,', url: 'https://remoteok.com/remote-jobs/42', description: '<p>React</p>', salary_min: 120000, salary_max: 150000, date: '2026-11-05T00:00:00Z' },
  ]), { headers: { 'content-type': 'application/json' } });
  try {
    const { fetchRemoteOK } = await import('../src/sources/remoteok.js');
    const [job] = await fetchRemoteOK();
    assert.equal(job.location, 'Remote (US)');
    assert.deepEqual(job.via, { name: 'Remote OK', url: 'https://remoteok.com/remote-jobs/42' });
    assert.equal(job.url, 'https://remoteok.com/remote-jobs/42');
    assert.deepEqual(job.salary, { min: 120000, max: 150000, currency: 'USD', interval: 'year' });
  } finally {
    globalThis.fetch = real;
  }
});
