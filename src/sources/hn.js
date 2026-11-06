// Hacker News "Ask HN: Who is hiring?" via the free Algolia HN API.
// Two jobs: every top-level comment is a job post, and the links in those
// posts are how we discover new companies' Greenhouse/Lever/Ashby boards.
import { getJson } from '../http.js';
import { htmlToText } from '../text.js';

export async function latestWhoIsHiringId() {
  const data = await getJson(
    'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=who%20is%20hiring&hitsPerPage=5'
  );
  const hit = (data.hits ?? []).find((h) => /who is hiring/i.test(h.title ?? ''));
  return hit?.objectID ?? null;
}

export async function fetchHackerNews() {
  const id = await latestWhoIsHiringId();
  if (!id) return { jobs: [], boards: [] };
  const thread = await getJson(`https://hn.algolia.com/api/v1/items/${id}`);
  const jobs = [];
  const boards = [];
  for (const c of thread.children ?? []) {
    if (!c.text) continue;
    const rawHtml = c.text;
    const text = htmlToText(rawHtml);
    const firstLine = text.split('\n')[0];
    const [companyPart, ...rest] = firstLine.split('|').map((s) => s.trim());
    boards.push(...findBoards(rawHtml));
    jobs.push({
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
    });
  }
  return { jobs, boards };
}

// Pull ATS board slugs out of any links in a post.
const BOARD_PATTERNS = [
  ['greenhouse', /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/gi],
  ['lever', /jobs\.lever\.co\/([a-z0-9_-]+)/gi],
  ['ashby', /jobs\.ashbyhq\.com\/([a-z0-9_.%-]+)/gi],
];

export function findBoards(html) {
  const found = [];
  const text = html.replace(/&#x2F;/g, '/').replace(/&amp;/g, '&');
  for (const [ats, re] of BOARD_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const slug = decodeURIComponent(m[1]).toLowerCase();
      if (slug && !['embed', 'jobs'].includes(slug)) found.push({ ats, slug });
    }
  }
  return found;
}
