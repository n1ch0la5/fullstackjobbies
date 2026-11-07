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

// ---- HN parsing (7 Nov 2026 fixes) ----
import { isFullStack } from '../src/filter.js';
import { hnJobForTest } from '../src/sources/hn.js';

test('HN: PhD posts are not listed even if they mention full stack', () => {
  const j = hnJobForTest({ id: 1, text: 'University of Cambridge | PhD in AI | ONSITE | £30k tax-free stipend<p>Full stack engineer skills welcome.' });
  assert.equal(isFullStack(j), false);
});

test('HN: no made-up title when no full stack role is named', () => {
  const j = hnJobForTest({ id: 2, text: 'Acme | Backend Engineer | Remote (US) | $150k-$180k<p>We build things.' });
  assert.equal(j.title, '');
  assert.equal(isFullStack(j), false);
});

test('HN: company from a sentence when the header is a headline', () => {
  const j = hnJobForTest({ id: 3, text: 'Backed by Sequoia Capital, Peregrine is the operational AI platform | Full Stack Engineer | SF | $175k-$300k' });
  assert.equal(j.company, 'Peregrine');
  assert.equal(j.title, 'Full Stack Engineer');
  const k = hnJobForTest({ id: 4, text: '*Software Engineer — Remote — US Only* - US Work Authorization Required<p>Kaveronix is a software consultancy hiring a full stack engineer. $80,000–$180,000/year.' });
  assert.equal(k.company, 'Kaveronix');
});

test('HN: role lists are not taken as locations', () => {
  const j = hnJobForTest({ id: 5, text: 'Data Micro | Full Stack Engineer | Multiple Roles (OT, Networking, Security) | Remote (US)' });
  assert.equal(j.location, 'Remote (US)');
});

test('salary over $500k is not treated as a salary', async () => {
  const { extractSalary } = await import('../src/extract.js');
  assert.equal(extractSalary('Principal track: up to ~$750k cash plus equity'), null);
  assert.deepEqual(extractSalary('$140k-$160k'), { min: 140000, max: 160000, currency: 'USD', interval: 'year' });
});
