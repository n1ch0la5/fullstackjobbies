// Optional: a small AI model reads the listing and pulls out facts the regexes
// miss. It never decides the rating itself; score.js does that from these facts,
// so ratings stay consistent and explainable.
//
// Only runs when ANTHROPIC_API_KEY is set, only on listings that passed the
// free filters, and only when a listing is new or its text changed.

const MODEL = process.env.JOBBIES_MODEL || 'claude-haiku-5-5';

const SYSTEM = `You extract facts from a job listing for a job-rating site. Reply with ONE JSON object and nothing else:
{
  "salary": {"min": number, "max": number, "currency": "USD|GBP|EUR|CAD|AUD|...", "interval": "year|hour|month"} | null,
  "stack": string[],                // lower-case technologies actually required, max 15
  "remote": true | false | null,    // true only if fully remote is allowed
  "rounds": number | null,          // number of interview stages if stated
  "interviewStyles": ("live_algorithm"|"take_home"|"paid_take_home"|"unpaid_take_home"|"pairing"|"conversation")[],
  "redFlags": string[],             // short labels: hype words (rockstar, ninja, 10x), "we're a family", unrealistic stack, vague pay, long hours, etc.
  "severeFlags": string[]           // only: unpaid trial work, equity-only or no salary, commission-only
}
Use null or [] when the listing does not say. Never guess a salary.`;

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function extractWithAI(job) {
  const text = `Company: ${job.company}\nTitle: ${job.title}\nLocation: ${job.location}\n\n${job.description}`.slice(0, 12000);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: 'user', content: text }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const out = (data.content ?? []).map((c) => c.text ?? '').join('');
  const json = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

// AI fills gaps and corrects the rules, but a salary the job board itself
// published always wins over anything read from prose.
export function mergeFacts(rules, ai, { boardSalary }) {
  if (!ai) return rules;
  const pick = (a, b) => (a === null || a === undefined || (Array.isArray(a) && a.length === 0) ? b : a);
  return {
    salary: boardSalary ?? pick(validSalary(ai.salary), rules.salary),
    stack: pick(ai.stack, rules.stack),
    remote: pick(ai.remote, rules.remote),
    rounds: pick(ai.rounds, rules.rounds),
    interviewStyles: [...new Set([...(ai.interviewStyles ?? []), ...rules.interviewStyles])],
    redFlags: [...new Set([...rules.redFlags, ...(ai.redFlags ?? [])])].slice(0, 12),
    severeFlags: [...new Set([...rules.severeFlags, ...(ai.severeFlags ?? [])])],
    extractedBy: 'rules+ai',
  };
}

function validSalary(s) {
  if (!s || typeof s.min !== 'number' || s.min <= 0) return null;
  return { min: s.min, max: typeof s.max === 'number' ? s.max : s.min, currency: s.currency || 'USD', interval: s.interval || 'year' };
}
