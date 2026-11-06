// Shared logic for the public agent API and the MCP server.
// Read-only: agents search and vet jobs here, then apply on the company's own page.
import { jobFitsWhere } from './location.js';
import { extractFacts } from './extract.js';
import { scoreJob, annualUsd } from './score.js';
import { readJobLink } from './linkreader.js';

const STYLES = ['live_algorithm', 'take_home', 'paid_take_home', 'unpaid_take_home', 'pairing', 'conversation'];
const list = (v) =>
  (Array.isArray(v) ? v : String(v ?? '').split(','))
    .map((s) => String(s).trim())
    .filter(Boolean);

export function normalizeSearch(params = {}) {
  const num = (v, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : undefined;
  };
  return {
    where: list(params.where).map((c) => c.toUpperCase()).slice(0, 20),
    includeAnywhere: params.include_anywhere !== false && params.include_anywhere !== 'false' && params.include_anywhere !== '0',
    includeUnstated: params.include_unstated !== false && params.include_unstated !== 'false' && params.include_unstated !== '0',
    minRating: num(params.min_rating, 0, 5) ?? 0,
    remoteOnly: params.remote_only === true || params.remote_only === 'true' || params.remote_only === '1',
    hide: list(params.hide_interview_styles).filter((s) => STYLES.includes(s)),
    stack: list(params.stack).map((s) => s.toLowerCase()).slice(0, 10),
    salaryMinUsd: num(params.salary_min_usd, 0, 2_000_000),
    query: String(params.q ?? params.query ?? '').trim().toLowerCase().slice(0, 100),
    limit: num(params.limit, 1, 100) ?? 25,
  };
}

export function searchJobs(jobs, raw, { siteUrl }) {
  const p = normalizeSearch(raw);
  const matches = jobs.filter((j) => {
    if (j.rating.level < p.minRating) return false;
    if (p.remoteOnly && !j.remote) return false;
    if (p.hide.some((h) => j.interviewStyles.includes(h))) return false;
    if (p.where.length && !jobFitsWhere(j.where, p.where, { includeAnywhere: p.includeAnywhere, includeUnstated: p.includeUnstated })) return false;
    if (p.stack.length && !p.stack.every((s) => j.stack.includes(s))) return false;
    if (p.salaryMinUsd) {
      const pay = annualUsd(j.salary);
      if (!pay || pay.max < p.salaryMinUsd) return false;
    }
    if (p.query) {
      const hay = `${j.title} ${j.company} ${j.location} ${j.stack.join(' ')}`.toLowerCase();
      if (!p.query.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  return {
    total: matches.length,
    jobs: matches.slice(0, p.limit).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      where: j.where,
      remote: j.remote,
      salary: j.salary,
      stack: j.stack,
      interview_rounds: j.rounds,
      interview_styles: j.interviewStyles,
      red_flags: j.redFlags,
      rating: { level: j.rating.level, name: j.rating.name, emoji: j.rating.emoji, reasons: j.rating.reasons },
      apply_url: j.url,
      page_url: j.slug ? `${siteUrl}/job/${j.slug}` : null,
      credit: j.via ?? null,
      first_seen: j.firstSeen,
    })),
  };
}

// Rate pasted text or a link, exactly like the website does.
export async function rateInput({ text, url }) {
  let job;
  if (url) {
    const read = await readJobLink(String(url));
    job = { source: 'link', ...read };
  } else if (text && String(text).trim()) {
    const t = String(text).slice(0, 30000);
    job = { source: 'paste', title: t.trim().split('\n')[0].slice(0, 140), description: t, location: '', remote: null, salary: null };
  } else {
    const e = new Error('Send "text" (a job description) or "url" (a job link).');
    e.status = 400;
    throw e;
  }
  const facts = extractFacts(job);
  const rating = scoreJob(facts);
  return {
    read_from: job.source === 'link' ? { title: job.title, company: job.company, location: job.location, url: job.url } : null,
    rating: { level: rating.level, name: rating.name, emoji: rating.emoji, reasons: rating.reasons },
    salary: facts.salary,
    remote: facts.remote,
    stack: facts.stack,
    interview_rounds: facts.rounds,
    interview_styles: facts.interviewStyles,
    red_flags: [...facts.severeFlags, ...facts.redFlags],
  };
}

// Jobs data lives with the static site; functions read it over HTTP from their own deploy.
let cached = { at: 0, data: null };
export async function loadJobs(origin) {
  if (cached.data && Date.now() - cached.at < 5 * 60 * 1000) return cached.data;
  const res = await fetch(`${origin}/data/jobs.json`);
  if (!res.ok) throw new Error(`jobs data: HTTP ${res.status}`);
  cached = { at: Date.now(), data: await res.json() };
  return cached.data;
}
