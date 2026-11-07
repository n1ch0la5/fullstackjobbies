// Jobs people added with an interview report (site → Supabase → approved by hand).
import { readJobLink } from '../linkreader.js';
import { hash } from '../text.js';
import { summarizeReports } from '../reports.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../site/config.js';

export async function fetchApprovedReports() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/approved_job_reports`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      'content-type': 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`reports: HTTP ${res.status}`);
  return res.json();
}

// Same job, different links: ignore case in the host, tracking params, "#…" and a trailing "/".
export function urlKey(raw) {
  try {
    const u = new URL(raw);
    for (const p of [...u.searchParams.keys()]) if (/^(utm_|gh_src|ref|source|lever-)/i.test(p)) u.searchParams.delete(p);
    u.hash = '';
    return `${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return raw;
  }
}

// Group reports by job: a listed job's id when the report came from its page, else the link.
export function groupReports(reports) {
  const groups = new Map();
  for (const r of reports) {
    const key = r.job_id ? `id:${r.job_id}` : `url:${urlKey(r.job_url)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.values()].map((list) => ({
    jobId: list.find((r) => r.job_id)?.job_id ?? null,
    url: list[0].job_url,
    reports: list,
    summary: summarizeReports(list),
  }));
}

// A job only people have told us about: read its link, or fall back to the text they pasted.
export async function jobFromReports(group) {
  const latest = group.reports[group.reports.length - 1];
  let read = null;
  try {
    read = await readJobLink(group.url);
  } catch (e) {
    if (!latest.description) throw e;
  }
  const description = read?.description || latest.description || '';
  return {
    source: 'report',
    sourceId: `report:${hash(urlKey(group.url)).slice(0, 12)}`,
    company: read?.company || latest.company || 'Unknown',
    title: read?.title || latest.title || 'Full Stack Engineer',
    url: group.url,
    location: read?.location || '',
    remote: read?.remote ?? null,
    description,
    salary: read?.salary ?? null,
    postedAt: null,
  };
}
