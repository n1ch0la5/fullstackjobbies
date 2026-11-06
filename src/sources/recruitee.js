// Recruitee public careers API (no auth): https://{company}.recruitee.com/api/offers/
import { getJson } from '../http.js';
import { htmlToText } from '../text.js';

export async function fetchRecruitee(company) {
  const data = await getJson(`https://${encodeURIComponent(company.slug)}.recruitee.com/api/offers/`);
  return (data.offers ?? []).map((o) => ({
    source: 'recruitee',
    sourceId: `rc:${company.slug}:${o.id}`,
    company: o.company_name || company.name || company.slug,
    title: o.title ?? '',
    url: o.careers_url ?? o.url,
    location: [o.location, o.remote ? 'Remote' : null].filter(Boolean).join(' · ') || [o.city, o.country].filter(Boolean).join(', '),
    remote: typeof o.remote === 'boolean' ? o.remote : null,
    description: htmlToText(`${o.description ?? ''}\n${o.requirements ?? ''}`),
    salary: recruiteeSalary(o.salary),
    postedAt: o.published_at ?? o.created_at ?? null,
  }));
}

function recruiteeSalary(s) {
  const min = Number(s?.min);
  if (!s || !(min > 0)) return null;
  const period = String(s.period ?? 'year').toLowerCase();
  return { min, max: Number(s.max) > 0 ? Number(s.max) : min, currency: s.currency ?? 'USD', interval: period.startsWith('hour') ? 'hour' : period.startsWith('month') ? 'month' : 'year' };
}
