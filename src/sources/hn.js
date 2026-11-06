// Hacker News "Ask HN: Who is hiring?" via the free Algolia HN API.
// Two jobs: every top-level comment in the latest thread is a job post, and the
// links in the last several months of posts are how we discover new companies'
// job boards (Greenhouse, Lever, Ashby, Recruitee, SmartRecruiters, Workable).
import { getJson } from '../http.js';
import { htmlToText } from '../text.js';

export async function recentWhoIsHiringIds(months = 6) {
  const data = await getJson(
    `https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=who%20is%20hiring&hitsPerPage=${months * 3 + 3}`
  );
  return (data.hits ?? [])
    .filter((h) => /who is hiring/i.test(h.title ?? ''))
    .slice(0, months)
    .map((h) => h.objectID);
}

// Kept for anything that only wants this month's thread.
export async function latestWhoIsHiringId() {
  return (await recentWhoIsHiringIds(1))[0] ?? null;
}

export async function fetchHackerNews({ discoveryMonths = Number(process.env.HN_DISCOVERY_MONTHS ?? 6) } = {}) {
  const ids = await recentWhoIsHiringIds(discoveryMonths);
  if (!ids.length) return { jobs: [], boards: [] };
  const jobs = [];
  const boards = [];
  for (const [i, id] of ids.entries()) {
    let thread;
    try {
      thread = await getJson(`https://hn.algolia.com/api/v1/items/${id}`);
    } catch (e) {
      if (i === 0) throw e;
      continue; // an older thread failing only costs us some discovery
    }
    for (const c of thread.children ?? []) {
      if (!c.text) continue;
      boards.push(...findBoards(c.text));
      if (i === 0) jobs.push(hnJob(c)); // only this month's posts are current enough to list
    }
  }
  return { jobs, boards };
}

function hnJob(c) {
    const rawHtml = c.text;
    const text = htmlToText(rawHtml);
    const firstLine = text.split('\n')[0];
    const [companyPart, ...rest] = firstLine.split('|').map((s) => s.trim());
    return {
      source: 'hn',
      sourceId: `hn:${c.id}`,
      company: (companyPart || 'Unknown').slice(0, 80),
      title: rest.find((p) => /engineer|developer|stack/i.test(p)) ?? rest[0] ?? firstLine.slice(0, 120),
      url: `https://news.ycombinator.com/item?id=${c.id}`,
      location: rest.find((p) => /remote|onsite|hybrid|,/i.test(p)) ?? '',
      remote: /\bremote\b/i.test(firstLine) ? true : null,
      description: text,
      salary: null,
      postedAt: c.created_at ?? null,
    };
}

// Pull ATS board slugs out of any links in a post.
const BOARD_PATTERNS = [
  ['greenhouse', /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/gi],
  ['lever', /jobs\.lever\.co\/([a-z0-9_-]+)/gi],
  ['ashby', /jobs\.ashbyhq\.com\/([a-z0-9_.%-]+)/gi],
  ['recruitee', /\b([a-z0-9-]+)\.recruitee\.com/gi],
  ['smartrecruiters', /(?:jobs|careers)\.smartrecruiters\.com\/([a-z0-9_-]+)/gi],
  ['workable', /apply\.workable\.com\/([a-z0-9_-]+)/gi],
];

export function findBoards(html) {
  const found = [];
  const text = html.replace(/&#x2F;/g, '/').replace(/&amp;/g, '&');
  for (const [ats, re] of BOARD_PATTERNS) {
    for (const m of text.matchAll(re)) {
      // SmartRecruiters company IDs can be case-sensitive; everyone else's slugs are lower case.
      const raw = decodeURIComponent(m[1]);
      const slug = ats === 'smartrecruiters' ? raw : raw.toLowerCase();
      if (slug && !['embed', 'jobs', 'api', 'www', 'j'].includes(slug)) found.push({ ats, slug });
    }
  }
  return found;
}
