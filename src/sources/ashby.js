// Ashby public Job Posting API (no auth), with compensation included.
// https://developers.ashbyhq.com/docs/public-job-posting-api
import { getJson } from '../http.js';
import { htmlToText } from '../text.js';

export async function fetchAshby(company) {
  const data = await getJson(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company.slug)}?includeCompensation=true`
  );
  return (data.jobs ?? []).map((j) => ({
    source: 'ashby',
    sourceId: `ab:${company.slug}:${j.id ?? j.jobUrl}`,
    company: company.name ?? company.slug,
    title: j.title ?? '',
    url: j.jobUrl ?? j.applyUrl,
    location: j.location ?? '',
    remote: typeof j.isRemote === 'boolean' ? j.isRemote : null,
    description: j.descriptionPlain ?? htmlToText(j.descriptionHtml ?? ''),
    salary: ashbySalary(j.compensation),
    postedAt: j.publishedAt ?? null,
  }));
}

function ashbySalary(comp) {
  const parts = comp?.summaryComponents ?? [];
  const s = parts.find((p) => p.compensationType === 'Salary' && p.minValue);
  if (!s) return null;
  const interval = (s.interval ?? '').toLowerCase().includes('hour') ? 'hour' : 'year';
  return { min: s.minValue, max: s.maxValue ?? s.minValue, currency: s.currencyCode ?? 'USD', interval };
}
