// The daily sift: discover → free filters → extract facts → score → save.
//   node src/run.js            full run
//   DRY_RUN=1 node src/run.js  don't write files
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { mapLimit } from './http.js';
import { hash } from './text.js';
import { fetchGreenhouse } from './sources/greenhouse.js';
import { fetchLever } from './sources/lever.js';
import { fetchAshby } from './sources/ashby.js';
import { fetchHackerNews } from './sources/hn.js';
import { fetchRecruitee } from './sources/recruitee.js';
import { fetchSmartRecruiters } from './sources/smartrecruiters.js';
import { fetchWorkable } from './sources/workable.js';
import { fetchRemoteOK } from './sources/remoteok.js';
import { needsName, lookUpName } from './names.js';
import { isFullStack } from './filter.js';
import { extractFacts } from './extract.js';
import { aiEnabled, extractWithAI, mergeFacts } from './ai.js';
import { scoreJob } from './score.js';
import { classifyLocation } from './location.js';

const DATA = new URL('../data/', import.meta.url);
const MAX_AI_PER_RUN = Number(process.env.MAX_AI_PER_RUN ?? 150);
const MAX_FAILS = 3;
const MAX_NAME_LOOKUPS = 60;
const FETCHERS = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
  recruitee: fetchRecruitee,
  smartrecruiters: fetchSmartRecruiters,
  workable: fetchWorkable,
};

async function readJson(name, fallback) {
  try {
    return JSON.parse(await readFile(new URL(name, DATA), 'utf8'));
  } catch {
    return fallback;
  }
}
async function writeJson(name, value) {
  if (process.env.DRY_RUN) return;
  await mkdir(DATA, { recursive: true });
  await writeFile(new URL(name, DATA), JSON.stringify(value, null, 2) + '\n');
}

export async function sift() {
  const companiesFile = await readJson('companies.json', { companies: [] });
  const cache = await readJson('cache.json', {});
  const stats = { boardsTried: 0, boardsFailed: 0, fetched: 0, fullStack: 0, withSalary: 0, aiCalls: 0, newBoards: 0 };

  // 1. Discover: HN thread first, because it also finds new company boards.
  let raw = [];
  try {
    const hn = await fetchHackerNews();
    raw.push(...hn.jobs);
    const known = new Set(companiesFile.companies.map((c) => `${c.ats}:${c.slug}`));
    for (const b of hn.boards) {
      const key = `${b.ats}:${b.slug}`;
      if (!known.has(key)) {
        known.add(key);
        companiesFile.companies.push({ ats: b.ats, slug: b.slug, name: b.slug, discovered: today() });
        stats.newBoards++;
      }
    }
  } catch (e) {
    console.warn(`HN fetch failed: ${e.message}`);
  }

  // Feeds that aren't one company's board.
  try {
    raw.push(...(await fetchRemoteOK()));
  } catch (e) {
    console.warn(`Remote OK fetch failed: ${e.message}`);
  }

  const active = companiesFile.companies.filter((c) => !c.disabled && FETCHERS[c.ats]);
  stats.boardsTried = active.length;

  // Give discovered companies real names ("duck-duck-go" → "DuckDuckGo"), a few dozen per run.
  const unnamed = active.filter((c) => !c.nameChecked && needsName(c)).slice(0, MAX_NAME_LOOKUPS);
  await mapLimit(unnamed, 6, async (c) => {
    c.name = await lookUpName(c);
    c.nameChecked = true;
  });

  const batches = await mapLimit(active, 6, async (c) => {
    try {
      const jobs = await FETCHERS[c.ats](c);
      c.fails = 0;
      return jobs;
    } catch (e) {
      c.fails = (c.fails ?? 0) + 1;
      if (c.fails >= MAX_FAILS) c.disabled = true;
      stats.boardsFailed++;
      console.warn(`${c.ats}/${c.slug}: ${e.message}${c.disabled ? ' (disabled)' : ''}`);
      return [];
    }
  });
  raw.push(...batches.flat());
  stats.fetched = raw.length;

  // 2. Free filter.
  const candidates = raw.filter(isFullStack);
  stats.fullStack = candidates.length;

  // 3. Extract facts (rules always; AI only for new or changed listings) and 4. score.
  const nextCache = {};
  const listed = [];
  const rejected = [];
  for (const job of candidates) {
    const h = hash(`${job.title}\n${job.description}\n${JSON.stringify(job.salary)}`);
    let facts = cache[job.sourceId]?.hash === h ? cache[job.sourceId].facts : null;
    if (!facts) {
      facts = extractFacts(job);
      if (aiEnabled() && stats.aiCalls < MAX_AI_PER_RUN) {
        try {
          stats.aiCalls++;
          facts = mergeFacts(facts, await extractWithAI(job), { boardSalary: job.salary });
        } catch (e) {
          console.warn(`AI extract failed for ${job.sourceId}: ${e.message}`);
        }
      }
    }
    nextCache[job.sourceId] = { hash: h, facts, firstSeen: cache[job.sourceId]?.firstSeen ?? today() };

    const rating = scoreJob(facts);
    const entry = {
      id: job.sourceId,
      company: job.company,
      title: job.title,
      url: job.url, // "Apply" always goes to the company's own page
      location: job.location,
      where: classifyLocation(job),
      via: job.via ?? null, // credit for feeds that require it (e.g. Remote OK)
      remote: facts.remote,
      salary: facts.salary,
      stack: facts.stack,
      rounds: facts.rounds,
      interviewStyles: facts.interviewStyles,
      redFlags: facts.redFlags,
      rating: { level: rating.level, name: rating.name, emoji: rating.emoji, reasons: rating.reasons },
      source: job.source,
      postedAt: job.postedAt,
      firstSeen: nextCache[job.sourceId].firstSeen,
    };
    // House rule: salary or it doesn't get posted. Severe ones are kept aside for Jobbie of the Week.
    if (facts.salary && rating.level > 0) listed.push(entry);
    else rejected.push(entry);
  }
  stats.withSalary = listed.length;

  listed.sort((a, b) => b.rating.level - a.rating.level || (b.firstSeen > a.firstSeen ? 1 : -1));
  const worst = [...rejected.filter((j) => j.rating.level === 0), ...listed.filter((j) => j.rating.level <= 1)]
    .sort((a, b) => a.rating.level - b.rating.level || b.redFlags.length - a.redFlags.length)
    .slice(0, 10);
  // Best Jobbie of the Week: Rocket ships only, most reasons-to-love first, newest breaks ties.
  // Chosen by rating alone; paid "Featured" slots never feed into this.
  const best = listed
    .filter((j) => j.rating.level === 5)
    .sort((a, b) => positives(b) - positives(a) || (b.firstSeen > a.firstSeen ? 1 : -1))
    .slice(0, 10);

  const now = new Date().toISOString();
  await writeJson('jobs.json', { updatedAt: now, count: listed.length, jobs: listed });
  await writeJson('best-jobbie-candidates.json', { updatedAt: now, jobs: best });
  await writeJson('worst-jobbie-candidates.json', { updatedAt: now, jobs: worst });
  await writeJson('cache.json', nextCache);
  await writeJson('companies.json', companiesFile);
  await writeJson('stats.json', { ...stats, updatedAt: new Date().toISOString() });

  console.log(JSON.stringify(stats));
  return { listed, best, worst, stats };
}

function positives(job) {
  return job.rating.reasons.filter((r) => r.startsWith('+')).length - job.redFlags.length;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  sift().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
