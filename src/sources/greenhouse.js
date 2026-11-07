// Greenhouse public Job Board API (no auth).
// https://developers.greenhouse.io/job-board.html
import { getJson } from '../http.js';
import { htmlToText } from '../text.js';

export async function fetchGreenhouse(company) {
  const data = await getJson(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.slug)}/jobs?content=true`
  );
  return (data.jobs ?? []).map((j) => ({
    source: 'greenhouse',
    sourceId: `gh:${company.slug}:${j.id}`,
    company: j.company_name || company.name || company.slug,
    title: j.title ?? '',
    url: j.absolute_url,
    location: j.location?.name ?? '',
    remote: null,
    description: htmlToText(j.content ?? ''),
    salary: null,
    // first_published is when the job went up; updated_at is just the last edit.
    postedAt: j.first_published ?? null,
  }));
}
