// Remote OK public feed (no auth): https://remoteok.com/api
// Their terms: name Remote OK as the source and link to the job's Remote OK page
// with a normal (followed) link. Each job keeps `via` so the site can show that credit.
// Element 0 of the response is metadata, not a job.
import { getJson } from '../http.js';
import { htmlToText } from '../text.js';

export async function fetchRemoteOK() {
  const data = await getJson('https://remoteok.com/api');
  return (Array.isArray(data) ? data.slice(1) : []).filter((j) => j && j.id).map((j) => ({
    source: 'remoteok',
    sourceId: `rok:${j.id}`,
    company: j.company ?? '',
    title: j.position ?? '',
    url: j.url, // Remote OK's own job page, as their terms require
    location: `Remote${j.location ? ` (${String(j.location).replace(/[,\s]+$/, '')})` : ''}`,
    remote: true,
    description: htmlToText(j.description ?? ''),
    salary: j.salary_min > 0 ? { min: j.salary_min, max: j.salary_max > 0 ? j.salary_max : j.salary_min, currency: 'USD', interval: 'year' } : null,
    postedAt: j.date ?? null,
    via: { name: 'Remote OK', url: j.url },
  }));
}
