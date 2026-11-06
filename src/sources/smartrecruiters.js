// SmartRecruiters public Posting API (no auth).
// The list has no descriptions, so we only fetch details for full stack titles.
import { getJson, mapLimit } from '../http.js';
import { htmlToText } from '../text.js';

const FULL_STACK = /\bfull[\s-]?stack\b|\bfullstack\b/i;

export async function fetchSmartRecruiters(company) {
  const base = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company.slug)}/postings`;
  const list = await getJson(`${base}?limit=100`);
  const wanted = (list.content ?? []).filter((p) => FULL_STACK.test(p.name ?? ''));
  return mapLimit(wanted, 3, async (p) => {
    let detail = {};
    try {
      detail = await getJson(`${base}/${encodeURIComponent(p.id)}`);
    } catch {
      // Keep the listing with what we have.
    }
    const sections = detail.jobAd?.sections ?? {};
    const text = ['jobDescription', 'qualifications', 'additionalInformation']
      .map((k) => sections[k]?.text ?? '')
      .join('\n');
    const loc = p.location ?? {};
    return {
      source: 'smartrecruiters',
      sourceId: `sr:${company.slug}:${p.id}`,
      company: p.company?.name ?? company.name ?? company.slug,
      title: p.name ?? '',
      url: detail.postingUrl ?? `https://jobs.smartrecruiters.com/${company.slug}/${p.id}`,
      location: [loc.remote ? 'Remote' : null, [loc.city, loc.region, loc.country?.toUpperCase()].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
      remote: typeof loc.remote === 'boolean' ? loc.remote : null,
      description: htmlToText(text),
      salary: null,
      postedAt: p.releasedDate ?? null,
    };
  });
}
