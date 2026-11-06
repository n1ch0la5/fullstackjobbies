// MCP server at /mcp (Streamable HTTP, stateless, JSON responses).
// Lets Claude, Cursor and other MCP clients search rated jobs and vet any job.
// Read-only: no sign-in, nothing stored, and it never applies to anything.
import { searchJobs, rateInput, loadJobs } from '../../src/api.js';

const SERVER = { name: 'fullstackjobbies', title: 'Full Stack Jobbies', version: '0.1.0' };
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, mcp-protocol-version, mcp-session-id',
};

const TOOLS = [
  {
    name: 'search_jobs',
    title: 'Search rated full stack jobs',
    description:
      'Search full stack jobs that list a salary, each rated on the Jobbie Scale (5 Rocket ship, 4 Solid, 3 Meh, 2 Bit whiffy, 1 Steaming pile, 0 Bloody mess). ' +
      'Returns facts, rating reasons, red flags and the apply link. Apply on the company page via apply_url; this server cannot apply.',
    inputSchema: {
      type: 'object',
      properties: {
        where: { type: 'array', items: { type: 'string' }, description: 'ISO country codes the person can work from, e.g. ["US","CA"]. Empty = anywhere.' },
        include_anywhere: { type: 'boolean', description: 'Include work-from-anywhere jobs (default true).' },
        include_unstated: { type: 'boolean', description: "Include remote jobs that don't say where (default true)." },
        min_rating: { type: 'integer', minimum: 0, maximum: 5, description: 'Lowest Jobbie Scale level to include.' },
        remote_only: { type: 'boolean' },
        stack: { type: 'array', items: { type: 'string' }, description: 'All of these technologies must be required, e.g. ["react","node"].' },
        hide_interview_styles: {
          type: 'array',
          items: { type: 'string', enum: ['live_algorithm', 'take_home', 'paid_take_home', 'unpaid_take_home', 'pairing', 'conversation'] },
          description: 'Leave out jobs that interview this way.',
        },
        salary_min_usd: { type: 'number', description: 'Top of the salary range must reach this (annual USD equivalent).' },
        query: { type: 'string', description: 'Words to match in title, company, location or stack.' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'rate_job',
    title: 'Rate any job listing',
    description:
      'Rate a job from anywhere on the Jobbie Scale. Pass "url" (Greenhouse, Lever, Ashby or most career pages; not LinkedIn or Indeed) or "text" (the pasted description). ' +
      'Returns the rating, reasons, red flags, salary, stack and interview style.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Link to the job posting.' },
        text: { type: 'string', description: 'The job description text.' },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
];

const reply = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

async function handle(msg, ctx) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(msg?.id ?? null, -32600, 'Invalid request');
  const isNotification = msg.id === undefined || msg.id === null;
  if (isNotification) return null; // notifications/initialized, cancellations, etc.

  switch (msg.method) {
    case 'initialize': {
      const asked = msg.params?.protocolVersion;
      return reply(msg.id, {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions:
          'Use search_jobs to find rated full stack jobs and rate_job to vet any listing. Ratings come from a transparent formula (see each rating.reasons). ' +
          'This server is read-only: to apply, open apply_url and apply on the company page.',
      });
    }
    case 'ping':
      return reply(msg.id, {});
    case 'tools/list':
      return reply(msg.id, { tools: TOOLS });
    case 'tools/call': {
      const { name, arguments: args = {} } = msg.params ?? {};
      try {
        let data;
        if (name === 'search_jobs') {
          const jobs = await loadJobs(ctx.origin);
          data = { updated_at: jobs.updatedAt, ...searchJobs(jobs.jobs ?? [], args, { siteUrl: ctx.siteUrl }) };
        } else if (name === 'rate_job') {
          data = await rateInput(args);
        } else {
          return fail(msg.id, -32602, `Unknown tool: ${name}`);
        }
        return reply(msg.id, { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: false });
      } catch (e) {
        return reply(msg.id, { content: [{ type: 'text', text: e.message || 'Something went wrong.' }], isError: true });
      }
    }
    default:
      return fail(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'This is an MCP endpoint. POST JSON-RPC here; see https://fullstackjobbies.com/agents' }), {
      status: 405,
      headers: { 'content-type': 'application/json', allow: 'POST, OPTIONS', ...CORS },
    });
  }
  const url = new URL(req.url);
  const ctx = { origin: url.origin, siteUrl: process.env.URL || url.origin };
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json(fail(null, -32700, 'Parse error'), { status: 400, headers: CORS });
  }
  const batch = Array.isArray(body);
  const results = (await Promise.all((batch ? body : [body]).map((m) => handle(m, ctx)))).filter(Boolean);
  if (!results.length) return new Response(null, { status: 202, headers: CORS });
  return Response.json(batch ? results : results[0], { headers: CORS });
};

export const config = { path: '/mcp' };
