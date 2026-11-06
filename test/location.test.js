import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLocation, jobFitsWhere } from '../src/location.js';

const where = (location, description = '', source = 'greenhouse') => classifyLocation({ location, description, source });

test('countries from common location strings', () => {
  assert.deepEqual(where('Remote (US)').countries, ['US']);
  assert.deepEqual(where('Austin, TX').countries, ['US']);
  assert.deepEqual(where('San Francisco, CA or Remote').countries, ['US']);
  assert.deepEqual(where('Toronto, ON').countries, ['CA']);
  assert.deepEqual(where('Remote - USA or Canada').countries, ['CA', 'US']);
  assert.deepEqual(where('London, UK').countries, ['GB']);
  assert.deepEqual(where('Berlin / Amsterdam').countries, ['DE', 'NL']);
  assert.deepEqual(where('Bengaluru').countries, ['IN']);
});

test('regions and anywhere', () => {
  assert.deepEqual(where('Remote, EMEA').regions, ['EMEA']);
  assert.deepEqual(where('Remote (Americas)').regions, ['LATAM', 'NA']);
  assert.equal(where('Remote - Worldwide').anywhere, true);
  assert.equal(where('Remote').anywhere, false);
  assert.deepEqual(where('Remote', 'You can work from US time zones.').countries, ['US']);
});

test('no false matches from prose', () => {
  assert.deepEqual(where('Remote', 'Help us build tools for Latin America merchants. Bank of America is a customer.').countries, []);
  assert.deepEqual(where('New York, NY', 'We have offices in London too.').countries, ['US'], 'location field wins over body text');
  assert.deepEqual(where('Remote', 'Laptop with 16 GB of RAM provided.').countries, []);
});

test('HN posts use their first line', () => {
  const w = where('', 'Acme | Full Stack Engineer | Remote (Canada) | $150k CAD\nWe use Rails.', 'hn');
  assert.deepEqual(w.countries, ['CA']);
});

test('matching what a person picked', () => {
  const picked = ['US', 'CA'];
  assert.ok(jobFitsWhere(where('Remote (US)'), picked));
  assert.ok(jobFitsWhere(where('Remote, North America'), picked));
  assert.ok(!jobFitsWhere(where('Berlin'), picked));
  assert.ok(!jobFitsWhere(where('Remote, EMEA'), picked));
  assert.ok(jobFitsWhere(where('Anywhere in the world'), picked));
  assert.ok(!jobFitsWhere(where('Anywhere in the world'), picked, { includeAnywhere: false }));
  assert.ok(jobFitsWhere(where('Remote'), picked));
  assert.ok(!jobFitsWhere(where('Remote'), picked, { includeUnstated: false }));
  assert.ok(jobFitsWhere(where('Berlin'), []), 'nothing picked shows everything');
});
