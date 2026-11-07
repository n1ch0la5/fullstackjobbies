import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSalary, extractStack, extractRounds, extractInterviewStyles, extractFacts, extractWorkStyle } from '../src/extract.js';
import { isFullStack } from '../src/filter.js';
import { scoreJob } from '../src/score.js';
import { findBoards } from '../src/sources/hn.js';
import { htmlToText } from '../src/text.js';

const job = (over = {}) => ({
  source: 'greenhouse', sourceId: 'x', company: 'Acme', title: 'Senior Full Stack Engineer',
  url: 'https://example.com', location: 'Remote (US)', remote: null, description: '', salary: null, postedAt: null,
  ...over,
});

test('salary: common formats', () => {
  assert.deepEqual(extractSalary('Base: $120k - $160k'), { min: 120000, max: 160000, currency: 'USD', interval: 'year' });
  assert.deepEqual(extractSalary('$120,000–$160,000 per year'), { min: 120000, max: 160000, currency: 'USD', interval: 'year' });
  assert.deepEqual(extractSalary('Salary 90-110k GBP'), { min: 90000, max: 110000, currency: 'GBP', interval: 'year' });
  assert.deepEqual(extractSalary('€70.000 - €85.000'), { min: 70000, max: 85000, currency: 'EUR', interval: 'year' });
  assert.deepEqual(extractSalary('$65 - $85/hr'), { min: 65, max: 85, currency: 'USD', interval: 'hour' });
  assert.deepEqual(extractSalary('CA$140,000 - CA$170,000'), { min: 140000, max: 170000, currency: 'CAD', interval: 'year' });
  assert.deepEqual(extractSalary('A$150k-A$180k'), { min: 150000, max: 180000, currency: 'AUD', interval: 'year' });
  assert.deepEqual(extractSalary('Salary: USD 220000 - 330000'), { min: 220000, max: 330000, currency: 'USD', interval: 'year' });
  assert.deepEqual(extractSalary('$170K – $220K • Offers Equity'), { min: 170000, max: 220000, currency: 'USD', interval: 'year' });
  assert.deepEqual(extractSalary('Pay: $150k+'), { min: 150000, max: 150000, currency: 'USD', interval: 'year' });
});

test('salary: ignores funding rounds and stray numbers', () => {
  assert.equal(extractSalary('We raised $50M in our Series B'), null);
  assert.equal(extractSalary('Team of 10-20 people, founded 2019'), null);
  assert.equal(extractSalary('Offices: 94105 - 94107 area, founded 2019 - 2021'), null);
  assert.equal(extractSalary('competitive salary and benefits'), null);
});

test('full stack filter', () => {
  assert.ok(isFullStack(job()));
  assert.ok(isFullStack(job({ title: 'Fullstack Developer' })));
  assert.ok(!isFullStack(job({ title: 'Frontend Engineer' })));
  assert.ok(!isFullStack(job({ title: 'Full Stack Engineering Intern' })));
  assert.ok(isFullStack(job({ source: 'hn', title: 'Full-stack engineer', company: 'Acme', description: 'Acme | Full-stack engineer | Remote | $140k' })));
});

test('stack, rounds, interview style', () => {
  assert.deepEqual(extractStack('We use React, Node.js and Postgres. Go to market fast.').sort(), ['node', 'postgres', 'react']);
  assert.ok(extractStack('Backend in Go, frontend in Svelte').includes('golang'));
  assert.equal(extractRounds('Our process is 3 rounds of interviews'), 3);
  assert.equal(extractRounds('a four-stage interview process'), 4);
  assert.deepEqual(extractInterviewStyles('No leetcode. We pair on a real problem.').sort(), ['conversation', 'pairing']);
  assert.deepEqual(extractInterviewStyles('Expect a HackerRank coding challenge'), ['live_algorithm']);
  assert.deepEqual(extractInterviewStyles('a paid take-home project'), ['paid_take_home']);
  assert.deepEqual(extractInterviewStyles('then an unpaid take-home'), ['unpaid_take_home']);
  assert.deepEqual(extractInterviewStyles('No leetcode, no take-home.'), ['conversation']);
});

test('a good listing rates Rocket ship', () => {
  const facts = extractFacts(job({
    description: 'Fully remote. $190k-$220k. Stack: React, Node, Postgres. Process: 2 rounds, we pair on a real task. No leetcode.',
  }));
  const r = scoreJob(facts);
  assert.equal(r.name, 'Rocket ship');
});

test('a hype-filled listing sinks, and severe flags hit Bloody mess', () => {
  const pile = scoreJob(extractFacts(job({
    title: 'Full Stack Rockstar Ninja (10x)',
    description: "We're a fast-paced family. Wear many hats. $70k-$75k. 6 rounds including a live coding whiteboard test.",
  })));
  assert.equal(pile.level, 1);
  const awful = scoreJob(extractFacts(job({ description: 'Equity-only to start, plus an unpaid trial week.' })));
  assert.equal(awful.name, 'Bloody mess');
});

test('HN links reveal new company boards', () => {
  const html = 'Apply: <a href="https:&#x2F;&#x2F;jobs.ashbyhq.com&#x2F;acme&#x2F;123">x</a> or https://boards.greenhouse.io/widgetco/jobs/1 and jobs.lever.co/foo-bar/abc';
  assert.deepEqual(findBoards(html), [
    { ats: 'greenhouse', slug: 'widgetco' },
    { ats: 'lever', slug: 'foo-bar' },
    { ats: 'ashby', slug: 'acme' },
  ]);
});

test('Greenhouse double-escaped HTML becomes text', () => {
  assert.equal(htmlToText('&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;&lt;ul&gt;&lt;li&gt;React&lt;/li&gt;&lt;/ul&gt;'), 'Hello & welcome\n- React');
});

test('work style: remote, hybrid or on-site', () => {
  const ws = (location, description = '', remote = null) => extractWorkStyle({ location, description, remote });
  assert.equal(ws('', 'Location\n\nSan Francisco\n\nLocation Type\n\nHybrid\n\nDepartment'), 'hybrid');
  assert.equal(ws('Remote (US)'), 'remote');
  assert.equal(ws('New York, NY', 'We work 3 days a week in the office.'), 'hybrid');
  assert.equal(ws('Austin, TX', 'This is an on-site role at our HQ.'), 'onsite');
  assert.equal(ws('Seattle, WA', 'We build hybrid cloud infrastructure.'), null);
  assert.equal(ws('', '', false), 'onsite');
  assert.equal(ws('Berlin', 'Fully remote within the EU.'), 'remote');
  assert.equal(ws('Remote', 'Our team is hybrid in London, but this role is remote.'), 'remote', 'location field wins');
});

test('work style never changes the rating', () => {
  const base = 'Full Stack Engineer. $180k - $210k. React and Node. 3 rounds, we pair on a real task.';
  const a = scoreJob(extractFacts(job({ location: 'Remote (US)', description: base })));
  const b = scoreJob(extractFacts(job({ location: 'Austin, TX', description: base + ' This is an on-site role.' })));
  assert.equal(a.level, b.level);
  assert.deepEqual(a.reasons, b.reasons);
});

test('salary with cents', () => {
  assert.deepEqual(extractSalary('Pay $160,000.00 - $180,000.00'), { min: 160000, max: 180000, currency: 'USD', interval: 'year' });
  assert.deepEqual(extractSalary('$95000.00 to $120000.00'), { min: 95000, max: 120000, currency: 'USD', interval: 'year' });
  assert.deepEqual(extractSalary('€60.000 - €75.000'), { min: 60000, max: 75000, currency: 'EUR', interval: 'year' });
});
