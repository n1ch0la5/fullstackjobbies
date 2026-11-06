// Lever public Postings API (no auth).
// https://github.com/lever/postings-api
import { getJson } from '../http.js';

export async function fetchLever(company) {
  const data = await getJson(
    `https://api.lever.co/v0/postings/${encodeURIComponent(company.slug)}?mode=json`
  );
  return (Array.isArray(data) ? data : []).map((j) => {
    const lists = (j.lists ?? []).map((l) => `${l.text}\n${l.content ?? ''}`).join('\n');
    const description = [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join('\n');
    const sr = j.salaryRange;
    return {
      source: 'lever',
      sourceId: `lv:${company.slug}:${j.id}`,
      company: company.name ?? company.slug,
      title: j.text ?? '',
      url: j.hostedUrl,
      location: j.categories?.location ?? '',
      remote: j.workplaceType ? j.workplaceType === 'remote' : null,
      description: description.replace(/<[^>]+>/g, ' '),
      salary:
        sr && sr.min
          ? { min: sr.min, max: sr.max ?? sr.min, currency: sr.currency ?? 'USD', interval: normInterval(sr.interval) }
          : null,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    };
  });
}

function normInterval(i = '') {
  i = i.toLowerCase();
  if (i.includes('hour')) return 'hour';
  if (i.includes('month')) return 'month';
  return 'year';
}
