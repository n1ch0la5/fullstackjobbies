// Turns a pasted job link into job text the checker can rate.
//   Greenhouse / Lever / Ashby links → their public APIs (clean and reliable)
//   Other pages → schema.org JobPosting data if present, otherwise the page text
//   LinkedIn, Indeed and friends → refused politely (login walls, and their terms forbid it)
// Runs server-side in a Netlify Function, so it must never fetch private addresses.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { htmlToText, decodeEntities } from './text.js';

const UA = 'Mozilla/5.0 (compatible; fullstackjobbies-checker/0.1; +https://fullstackjobbies.com)';
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 8000;

export class LinkError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

const NO_GO = [
  [/(^|\.)linkedin\.com$/, 'LinkedIn'],
  [/(^|\.)indeed\.[a-z.]+$/, 'Indeed'],
  [/(^|\.)glassdoor\.[a-z.]+$/, 'Glassdoor'],
  [/(^|\.)ziprecruiter\.com$/, 'ZipRecruiter'],
];

export function parseJobUrl(input) {
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new LinkError("That doesn't look like a link.");
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new LinkError('Only http and https links work.');
  const host = url.hostname.toLowerCase();
  for (const [re, name] of NO_GO) {
    if (re.test(host)) {
      throw new LinkError(`${name} blocks other sites from reading its job pages. Copy the description text from the page and paste that instead.`);
    }
  }
  const parts = url.pathname.split('/').filter(Boolean);

  if (/^(boards|job-boards)(\.eu)?\.greenhouse\.io$/.test(host)) {
    const i = parts.indexOf('jobs');
    const board = parts[0] === 'embed' ? url.searchParams.get('for') : parts[0];
    const id = i >= 0 ? parts[i + 1] : url.searchParams.get('token');
    if (board && id) return { kind: 'greenhouse', board, id, url };
  }
  const ghId = url.searchParams.get('gh_jid');
  if (ghId && url.searchParams.get('for')) return { kind: 'greenhouse', board: url.searchParams.get('for'), id: ghId, url };

  const lever = host.match(/^jobs\.(eu\.)?lever\.co$/);
  if (lever && parts.length >= 2) return { kind: 'lever', eu: Boolean(lever[1]), slug: parts[0], id: parts[1], url };

  if (host === 'jobs.ashbyhq.com' && parts.length >= 2) return { kind: 'ashby', slug: parts[0], id: parts[1], url };

  return { kind: 'page', url };
}

// ---------- Safety: never let a pasted link reach private networks ----------
export function isPrivateAddress(ip) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === '::' || v6 === '::1') return true;
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6);
}

async function assertPublicHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || /\.(localhost|local|internal|lan|home|corp)$/i.test(host)) {
    throw new LinkError("That link points somewhere we can't reach.");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => {
    throw new LinkError("We couldn't find that website. Check the link?");
  });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new LinkError("That link points somewhere we can't reach.");
  }
}

// Fetch with our own redirect handling so every hop gets the same safety check.
export async function safeFetch(rawUrl, { accept = 'text/html,application/json' } = {}) {
  let url = new URL(rawUrl);
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(url.hostname);
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': UA, Accept: accept },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location'), url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new LinkError('That link redirects somewhere odd.');
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new LinkError("That site won't let us in. Paste the description text instead.");
    if (res.status === 404 || res.status === 410) throw new LinkError('That job page is gone. It may have been filled or taken down.');
    if (!res.ok) throw new LinkError(`That site answered with an error (${res.status}). Paste the description text instead.`);
    return { res, body: await readCapped(res), finalUrl: url };
  }
  throw new LinkError('That link redirects too many times.');
}

async function readCapped(res) {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// ---------- Readers ----------
async function readGreenhouse({ board, id }) {
  const { body } = await safeFetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(id)}?pay_transparency=true`, { accept: 'application/json' });
  const j = JSON.parse(body);
  const pay = (j.pay_input_ranges ?? [])[0];
  return {
    title: j.title ?? '',
    company: j.company_name ?? board,
    location: j.location?.name ?? '',
    description: htmlToText(j.content ?? ''),
    salary: pay?.min_cents ? { min: pay.min_cents / 100, max: (pay.max_cents ?? pay.min_cents) / 100, currency: pay.currency_type ?? 'USD', interval: 'year' } : null,
    remote: null,
    via: 'greenhouse',
  };
}

async function readLever({ eu, slug, id }) {
  const { body } = await safeFetch(`https://api.${eu ? 'eu.' : ''}lever.co/v0/postings/${encodeURIComponent(slug)}/${encodeURIComponent(id)}`, { accept: 'application/json' });
  const j = JSON.parse(body);
  const lists = (j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content ?? '')}`).join('\n');
  const sr = j.salaryRange;
  return {
    title: j.text ?? '',
    company: slug,
    location: j.categories?.location ?? '',
    description: [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join('\n'),
    salary: sr?.min ? { min: sr.min, max: sr.max ?? sr.min, currency: sr.currency ?? 'USD', interval: /hour/i.test(sr.interval ?? '') ? 'hour' : 'year' } : null,
    remote: j.workplaceType ? j.workplaceType === 'remote' : null,
    via: 'lever',
  };
}

async function readAshby({ slug, id }) {
  const { body } = await safeFetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`, { accept: 'application/json' });
  const data = JSON.parse(body);
  const j = (data.jobs ?? []).find((x) => x.id === id || (x.jobUrl ?? '').includes(id));
  if (!j) throw new LinkError('That job is no longer on their board. It may have been filled.');
  const s = (j.compensation?.summaryComponents ?? []).find((p) => p.compensationType === 'Salary' && p.minValue);
  return {
    title: j.title ?? '',
    company: slug,
    location: j.location ?? '',
    description: j.descriptionPlain ?? htmlToText(j.descriptionHtml ?? ''),
    salary: s ? { min: s.minValue, max: s.maxValue ?? s.minValue, currency: s.currencyCode ?? 'USD', interval: /hour/i.test(s.interval ?? '') ? 'hour' : 'year' } : null,
    remote: typeof j.isRemote === 'boolean' ? j.isRemote : null,
    via: 'ashby',
  };
}

// Many career pages embed structured job data for Google. Use it when it's there.
export function findJobPosting(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, raw] of blocks) {
    let data;
    try {
      data = JSON.parse(raw.trim());
    } catch {
      continue;
    }
    const stack = [data];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) { stack.push(...node); continue; }
      const type = node['@type'];
      if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return node;
      if (node['@graph']) stack.push(node['@graph']);
    }
  }
  return null;
}

export function fromJobPosting(p) {
  const places = [p.jobLocation].flat().filter(Boolean).map((l) => {
    const a = l.address ?? {};
    return [a.addressLocality, a.addressRegion, typeof a.addressCountry === 'object' ? a.addressCountry.name : a.addressCountry].filter(Boolean).join(', ');
  });
  const remote = p.jobLocationType === 'TELECOMMUTE';
  const applicant = [p.applicantLocationRequirements].flat().filter(Boolean).map((r) => r.name).filter(Boolean);
  const location = [...(remote ? [`Remote${applicant.length ? ` (${applicant.join(', ')})` : ''}`] : []), ...places].join(' · ');
  const v = p.baseSalary?.value ?? {};
  const unit = String(v.unitText ?? p.baseSalary?.unitText ?? 'YEAR').toUpperCase();
  const min = Number(v.minValue ?? v.value);
  const max = Number(v.maxValue ?? v.value ?? v.minValue);
  return {
    title: decodeEntities(p.title ?? ''),
    company: p.hiringOrganization?.name ?? '',
    location,
    description: htmlToText(p.description ?? ''),
    salary: min > 0 ? { min, max: max > 0 ? max : min, currency: p.baseSalary?.currency ?? 'USD', interval: unit === 'HOUR' ? 'hour' : unit === 'MONTH' ? 'month' : 'year' } : null,
    remote: remote || null,
    via: 'structured data',
  };
}

export function pageText(html) {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  const cleaned = main
    .replace(/<(script|style|noscript|svg|nav|header|footer|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  return { title, text: htmlToText(cleaned).slice(0, 20000) };
}

async function readPage({ url }) {
  const { res, body } = await safeFetch(url.href);
  const type = res.headers.get('content-type') ?? '';
  if (!/html|xml|text\/plain/.test(type)) throw new LinkError("That link isn't a web page we can read.");
  const posting = findJobPosting(body);
  if (posting) return fromJobPosting(posting);
  const { title, text } = pageText(body);
  if (text.length < 300) {
    throw new LinkError("We couldn't find the job text on that page. It may load with JavaScript. Paste the description text instead.");
  }
  return { title, company: '', location: '', description: text, salary: null, remote: null, via: 'page text' };
}

export async function readJobLink(input) {
  const target = parseJobUrl(input);
  const readers = { greenhouse: readGreenhouse, lever: readLever, ashby: readAshby, page: readPage };
  const job = await readers[target.kind](target);
  return { ...job, description: job.description.slice(0, 20000), url: target.url.href };
}
