// Workable public widget API (no auth): the feed behind companies' Workable career pages.
import { getJson } from '../http.js';
import { htmlToText } from '../text.js';

export async function fetchWorkable(company) {
  const data = await getJson(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(company.slug)}?details=true`);
  return (data.jobs ?? []).map((j) => ({
    source: 'workable',
    sourceId: `wk:${company.slug}:${j.shortcode ?? j.id}`,
    company: data.name || company.name || company.slug,
    title: j.title ?? '',
    url: j.url ?? j.application_url ?? `https://apply.workable.com/${company.slug}/j/${j.shortcode}/`,
    location: [j.telecommuting ? 'Remote' : null, [j.city, j.state, j.country].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    remote: typeof j.telecommuting === 'boolean' ? j.telecommuting : null,
    description: htmlToText(j.description ?? ''),
    salary: null,
    postedAt: j.published_on ?? j.created_at ?? null,
  }));
}
