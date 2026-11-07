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

const URLISH = /^(https?:\/\/|www\.)\S+$|^\S+\.(com|io|ai|co|dev|app|org|net)(\/\S*)?$/i;
const PAYISH = /^[$£€]|\b\d{2,3}k\b|\bequity\b|\bsalary\b/i;
const ROLEISH = /engineer|developer|\bstack\b|fullstack|programmer|\bswe\b/i;
const PLACE_WORDS = /remote|onsite|on-site|hybrid|in-office|\b(us|usa|uk|eu|emea|canada|nyc|sf)\b/i;
const PLACE_SHAPE = /,\s*[A-Z]{2}\b|\b[A-Z][a-z]+,\s*[A-Z]/; // "Austin, TX", "Berlin, Germany"
const NOT_PLACE = /\broles?\b|\bpositions?\b|\bopenings?\b|consultant|engineer|developer|hiring/i;
const isPlace = (p) => (PLACE_WORDS.test(p) || PLACE_SHAPE.test(p)) && !NOT_PLACE.test(p);
const FULL_STACK = /\bfull[\s-]?stack\b|\bfullstack\b/i;

// The first part is usually the company, but some posts lead with a headline or a sentence.
// Then look for "<Name> is a/an/the …" early in the post; give up rather than guess.
function companyFrom(part, text) {
  const clean = (part ?? '').replace(/^[*_\s]+|[*_\s]+$/g, '');
  if (clean && clean.length < 60 && !ROLEISH.test(clean) && !/[.!?]$/.test(clean)) return clean;
  const m = text.slice(0, 400).match(/\b([A-Z][A-Za-z0-9.&'-]+(?: [A-Z][A-Za-z0-9.&'-]+)?) +(?:is|are) +(?:a|an|the)\b/);
  return m ? m[1] : 'Unknown';
}

function hnJob(c) {
  const text = htmlToText(c.text);
  const firstLine = text.split('\n')[0].trim();
  const parts = firstLine.split(/\s+\|\s+|\|/).map((s) => s.trim()).filter(Boolean);
  const [companyPart, ...rest] = parts;
  const usable = rest.filter((p) => !URLISH.test(p) && p.length < 120);
  // A full stack role named in the header, or a full stack role phrase in the text. No
  // made-up fallback title: a post that never names a full stack role isn't listed.
  const title = usable.find((p) => FULL_STACK.test(p) && ROLEISH.test(p) && !PAYISH.test(p)) ?? roleFromText(text) ?? '';
  const location = usable.find((p) => p !== title && isPlace(p) && !ROLEISH.test(p)) ?? '';
  return {
    source: 'hn',
    sourceId: `hn:${c.id}`,
    company: companyFrom(companyPart, text),
    title: title.slice(0, 120),
    url: `https://news.ycombinator.com/item?id=${c.id}`,
    location,
    remote: /\bremote\b/i.test(firstLine) ? true : null,
    description: text,
    salary: null,
    postedAt: c.created_at ?? null,
  };
}

// For posts that skip the "Company | Role | Place" format, find a full stack role phrase.
function roleFromText(text) {
  const m = text.match(/\b((?:senior|staff|lead|principal|junior|mid[- ]level|founding)\s+)?(?:full[\s-]?stack|fullstack)(?:\s+(?:software|product|web|ai))?\s+(?:engineer|developer)s?\b/i);
  if (!m) return null;
  const role = m[0].replace(/\s+/g, ' ');
  return role.replace(/\b\w/g, (ch) => ch.toUpperCase()).replace(/s$/, '');
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
export const hnJobForTest = hnJob;
