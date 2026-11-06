import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJobUrl, isPrivateAddress, findJobPosting, fromJobPosting, pageText, LinkError } from '../src/linkreader.js';
import handler from '../netlify/functions/read-job.mjs';

test('recognises job board links', () => {
  assert.deepEqual(pick(parseJobUrl('https://boards.greenhouse.io/gitlab/jobs/12345')), { kind: 'greenhouse', board: 'gitlab', id: '12345' });
  assert.deepEqual(pick(parseJobUrl('https://job-boards.greenhouse.io/figma/jobs/987?gh_src=x')), { kind: 'greenhouse', board: 'figma', id: '987' });
  assert.deepEqual(pick(parseJobUrl('https://jobs.lever.co/plaid/0b1c-uuid')), { kind: 'lever', eu: false, slug: 'plaid', id: '0b1c-uuid' });
  assert.deepEqual(pick(parseJobUrl('https://jobs.eu.lever.co/acme/abc/apply')), { kind: 'lever', eu: true, slug: 'acme', id: 'abc' });
  assert.deepEqual(pick(parseJobUrl('https://jobs.ashbyhq.com/ramp/1234-abcd')), { kind: 'ashby', slug: 'ramp', id: '1234-abcd' });
  assert.equal(parseJobUrl('https://careers.example.com/jobs/42').kind, 'page');
});

test('refuses LinkedIn and friends, and junk', () => {
  assert.throws(() => parseJobUrl('https://www.linkedin.com/jobs/view/123'), (e) => e instanceof LinkError && /LinkedIn/.test(e.message));
  assert.throws(() => parseJobUrl('https://uk.indeed.com/viewjob?jk=1'), /Indeed/);
  assert.throws(() => parseJobUrl('ftp://example.com/job'), LinkError);
  assert.throws(() => parseJobUrl('not a link'), LinkError);
});

test('private addresses are blocked', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
    assert.ok(isPrivateAddress(ip), ip);
  }
  for (const ip of ['8.8.8.8', '151.101.1.1', '2606:4700::1111']) assert.ok(!isPrivateAddress(ip), ip);
});

test('reads schema.org JobPosting data from career pages', () => {
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [{ '@type': 'Organization', name: 'X' }, {
      '@type': 'JobPosting',
      title: 'Full Stack Engineer',
      description: '<p>React &amp; Rails. 3 rounds.</p>',
      hiringOrganization: { name: 'Widgetco' },
      jobLocationType: 'TELECOMMUTE',
      applicantLocationRequirements: [{ '@type': 'Country', name: 'USA' }],
      baseSalary: { currency: 'USD', value: { minValue: 150000, maxValue: 180000, unitText: 'YEAR' } },
    }],
  })}</script></head><body>…</body></html>`;
  const job = fromJobPosting(findJobPosting(html));
  assert.equal(job.title, 'Full Stack Engineer');
  assert.equal(job.company, 'Widgetco');
  assert.equal(job.location, 'Remote (USA)');
  assert.deepEqual(job.salary, { min: 150000, max: 180000, currency: 'USD', interval: 'year' });
  assert.equal(job.description, 'React & Rails. 3 rounds.');
});

test('falls back to the main page text without the clutter', () => {
  const { title, text } = pageText('<title>Job &amp; stuff</title><body><nav>Home About</nav><main><h1>Full Stack Dev</h1><p>We pay $120k.</p><script>track()</script></main><footer>©</footer></body>');
  assert.equal(title, 'Job & stuff');
  assert.equal(text, 'Full Stack Dev\nWe pay $120k.');
});

test('the function answers refusals as friendly JSON', async () => {
  const res = await handler(new Request('https://x.test/api/read-job?url=' + encodeURIComponent('https://www.linkedin.com/jobs/view/1')));
  assert.equal(res.status, 422);
  assert.match((await res.json()).error, /LinkedIn/);
  const empty = await handler(new Request('https://x.test/api/read-job'));
  assert.equal(empty.status, 400);
});

function pick({ url, ...rest }) {
  return rest;
}
