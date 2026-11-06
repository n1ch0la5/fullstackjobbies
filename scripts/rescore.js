// Re-rate the current jobs with the current formula, without fetching anything.
// Use after changing src/score.js so the site updates before the next daily sift.
//   node scripts/rescore.js
import { readFile, writeFile } from 'node:fs/promises';
import { scoreJob } from '../src/score.js';

const path = 'data/jobs.json';
const data = JSON.parse(await readFile(path, 'utf8'));
const cache = JSON.parse(await readFile('data/cache.json', 'utf8').catch(() => '{}'));
const before = {};
const after = {};
for (const j of data.jobs) {
  before[j.rating.name] = (before[j.rating.name] ?? 0) + 1;
  const facts = cache[j.id]?.facts ?? {
    salary: j.salary, remote: j.remote, rounds: j.rounds, interviewStyles: j.interviewStyles,
    redFlags: j.redFlags, severeFlags: [], stack: j.stack,
  };
  const r = scoreJob(facts);
  j.rating = { level: r.level, name: r.name, emoji: r.emoji, reasons: r.reasons };
  after[r.name] = (after[r.name] ?? 0) + 1;
}
data.jobs.sort((a, b) => b.rating.level - a.rating.level || (b.firstSeen > a.firstSeen ? 1 : -1));
await writeFile(path, JSON.stringify(data, null, 2) + '\n');

// Rocket of the Week candidates follow the new ratings.
const positives = (j) => j.rating.reasons.filter((r) => r.startsWith('+')).length - j.redFlags.length;
const best = data.jobs.filter((j) => j.rating.level === 5).sort((a, b) => positives(b) - positives(a)).slice(0, 10);
await writeFile('data/best-jobbie-candidates.json', JSON.stringify({ updatedAt: new Date().toISOString(), jobs: best }, null, 2) + '\n');

console.log('before', before);
console.log('after ', after);
