// Public agent API (read-only, no key needed).
//   GET  /api/jobs?where=US,CA&min_rating=4&stack=react,node&hide_interview_styles=live_algorithm&limit=20
//   POST /api/rate   { "text": "<job description>" }  or  { "url": "<job link>" }
//   GET  /api/rate?url=<job link>
import { searchJobs, rateInput, loadJobs } from '../../src/api.js';
import { LinkError } from '../../src/linkreader.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra } });

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const siteUrl = process.env.URL || url.origin;

  try {
    if (url.pathname === '/api/jobs') {
      if (req.method !== 'GET') return json(405, { error: 'Use GET.' });
      const data = await loadJobs(url.origin);
      const result = searchJobs(data.jobs ?? [], Object.fromEntries(url.searchParams), { siteUrl });
      return json(200, { updated_at: data.updatedAt, ...result }, { 'netlify-cdn-cache-control': 'public, s-maxage=300' });
    }

    if (url.pathname === '/api/rate') {
      let input;
      if (req.method === 'GET') input = { url: url.searchParams.get('url'), text: url.searchParams.get('text') };
      else if (req.method === 'POST') input = await req.json().catch(() => ({}));
      else return json(405, { error: 'Use GET or POST.' });
      return json(200, await rateInput(input ?? {}));
    }

    return json(404, { error: 'Unknown endpoint. See https://fullstackjobbies.com/agents' });
  } catch (e) {
    if (e instanceof LinkError || e.status) return json(e.status ?? 422, { error: e.message });
    console.error('api error', e);
    return json(500, { error: 'Something went wrong on our side. Try again shortly.' });
  }
};

export const config = { path: ['/api/jobs', '/api/rate'] };
