// GET /api/read-job?url=<job link>  →  { title, company, location, description, salary, remote, via, url }
// The browser then rates it with the same rules as everything else on the site.
import { readJobLink, LinkError } from '../../src/linkreader.js';

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Use GET.' });
  const link = new URL(req.url).searchParams.get('url');
  if (!link || link.length > 2000) return json(400, { error: 'Paste a job link.' });

  try {
    const job = await readJobLink(link);
    // Job pages don't change by the minute; let Netlify's CDN reuse a result for an hour.
    return json(200, job, {
      'cache-control': 'public, max-age=0, must-revalidate',
      'netlify-cdn-cache-control': 'public, s-maxage=3600, stale-while-revalidate=600',
    });
  } catch (e) {
    if (e instanceof LinkError) return json(e.status, { error: e.message });
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    console.error('read-job failed', link, e);
    return json(502, {
      error: timeout ? 'That site took too long to answer. Paste the description text instead.' : "We couldn't read that page. Paste the description text instead.",
    });
  }
};

export const config = { path: '/api/read-job' };
