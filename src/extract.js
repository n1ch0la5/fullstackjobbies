// Free fact extraction with plain code. Pulls the same fields the AI step does,
// so the sifter works (more roughly) with no API key at all.

const SYMBOL_CCY = { $: 'USD', '£': 'GBP', '€': 'EUR' };
// 120,000 or 120.000 · 120000 (structured data often has no separators) · 120 or 120.5 (with k)
const NUM = String.raw`\d{1,3}(?:[,.]\d{3})+|\d{5,6}(?!\d)|\d{2,3}(?:\.\d+)?`;
const RANGE = new RegExp(
  String.raw`(USD|GBP|EUR|CAD|AUD)?\s?([$£€])?\s?(${NUM})\s?([kK])?\s?(?:-|–|—|to)\s?([$£€])?\s?(${NUM})\s?([kK])?\s?(USD|GBP|EUR|CAD|AUD)?(\s?(?:\/|per)\s?(?:hr|hour|h\b))?`,
  'g'
);
const SINGLE = new RegExp(String.raw`([$£€])\s?(${NUM})\s?([kK])?\s?\+?(\s?(?:\/|per)\s?(?:hr|hour|h\b))?`, 'g');

function toNumber(raw, k) {
  let n = Number(raw.replace(/[,.](?=\d{3}\b)/g, ''));
  if (k) n *= 1000;
  return n;
}

// Above this, a "salary" is an exec or principal track ("up to ~$750k") or a misread
// number, not a full stack salary to compare against.
const MAX_YEARLY = 500000;

export function extractSalary(rawText) {
  // "CA$140k", "C$140k" and "A$120k" are dollars too, just not American ones.
  const dollar = /\b(?:CA|C)\$/.test(rawText) ? 'CAD' : /\b(?:AU|A)\$/.test(rawText) ? 'AUD' : 'USD';
  const text = rawText.replace(/\b(?:CA|C|AU|A)\$/g, '$');
  const SYMBOL_CCY = { $: dollar, '£': 'GBP', '€': 'EUR' };
  for (const m of text.matchAll(RANGE)) {
    const [, codeA, symA, a, kA, symB, b, kB, codeB, hourly] = m;
    const sym = symA || symB;
    const code = codeA || codeB;
    const hasK = kA || kB;
    if (!sym && !code && !hasK) continue; // a bare "10-20" is not a salary
    let min = toNumber(a, kA || (kB && Number(a) < 1000));
    let max = toNumber(b, kB || (kA && Number(b) < 1000));
    if (min > max) [min, max] = [max, min];
    const currency = code || SYMBOL_CCY[sym] || 'USD';
    if (hourly && min >= 15 && max <= 500) return { min, max, currency, interval: 'hour' };
    if (min >= 20000 && max <= MAX_YEARLY && max / min < 3) return { min, max, currency, interval: 'year' };
  }
  for (const m of text.matchAll(SINGLE)) {
    const [, sym, a, k, hourly] = m;
    const n = toNumber(a, k);
    const currency = SYMBOL_CCY[sym];
    if (hourly && n >= 15 && n <= 500) return { min: n, max: n, currency, interval: 'hour' };
    if (!hourly && n >= 20000 && n <= MAX_YEARLY) return { min: n, max: n, currency, interval: 'year' };
  }
  return null;
}

const STACK = [
  'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'remix', 'typescript', 'javascript',
  'node', 'deno', 'bun', 'python', 'django', 'flask', 'fastapi', 'ruby', 'rails', 'golang',
  'rust', 'java', 'kotlin', 'spring', 'c#', '.net', 'php', 'laravel', 'elixir', 'phoenix',
  'postgres', 'mysql', 'mongodb', 'redis', 'graphql', 'aws', 'gcp', 'azure', 'kubernetes',
  'docker', 'terraform', 'tailwind', 'react native', 'swift', 'flutter',
];

export function extractStack(text) {
  const t = ` ${text.toLowerCase()} `;
  const found = STACK.filter((s) => {
    const esc = s.replace(/[.+#]/g, (c) => `\\${c}`);
    return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(t);
  });
  // "Go" the language is capitalised and usually sits in a list; "go to market" is not it.
  if (!found.includes('golang') && /(^|[\s,/(])Go(?=[\s,/)]|$)(?! (to|ahead|live|on|for|beyond)\b)/m.test(text)) found.push('golang');
  return found;
}

const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
export function extractRounds(text) {
  const m = text.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]*(?:stage|step|round|part)s?\b(?:[^.\n]{0,40}\b(?:interview|process))?/i);
  if (!m) return null;
  const n = WORDNUM[m[1].toLowerCase()] ?? Number(m[1]);
  return n >= 1 && n <= 12 ? n : null;
}

// How do they interview? Ordered so explicit "no leetcode" beats a passing mention.
export function extractInterviewStyles(text) {
  const t = text.toLowerCase();
  const styles = new Set();
  const negatedAlgo = /\bno (leetcode|live[- ]coding|whiteboard|algorithm|brain ?teasers?|trick questions)/.test(t);
  if (!negatedAlgo && /leetcode|hackerrank|codility|live[- ]coding|whiteboard|algorithm(ic)? (interview|challenge|test|round)|coding (challenge|test|assessment)/.test(t)) {
    styles.add('live_algorithm');
  }
  if (/(?<!un)\bpaid (take[- ]home|project|trial|work sample)|we pay (you )?for (the|your) (take[- ]home|project|time)/.test(t)) {
    styles.add('paid_take_home');
  } else if (/take[- ]home/.test(t) && !/\b(no|without( a)?|never|skip the) take[- ]homes?\b/.test(t)) {
    styles.add(/unpaid/.test(t) ? 'unpaid_take_home' : 'take_home');
  }
  if (/\bpair(ing\b| program| on\b| with (us|an engineer|one of))|work on a real (problem|task|ticket)|real[- ]world (task|problem|project)/.test(t)) styles.add('pairing');
  if (negatedAlgo || /conversational|just a conversation|talk (through|about) (your|past) (work|projects)|no (technical|coding) (test|interview)/.test(t)) {
    styles.add('conversation');
  }
  return [...styles];
}

const RED_FLAGS = [
  ['rockstar', /\brock ?stars?\b/i],
  ['ninja', /\bninjas?\b/i],
  ['guru', /\bgurus?\b/i],
  ['wizard', /\bwizards?\b/i],
  ['unicorn', /\bunicorns?\b(?! (startup|company))/i],
  ['10x', /\b10x\b/i],
  ['"we\'re a family"', /\b(like a|we'?re a|one big) family\b/i],
  ['fast-paced', /\bfast[- ]paced\b/i],
  ['wears many hats', /\bwears? (many|multiple|lots of) hats\b/i],
  ['work hard, play hard', /\bwork hard,? play hard\b/i],
  ['hustle culture', /\bhustle\b|\bgrind(set)?\b/i],
  ['long hours', /\b(long hours|nights and weekends|unlimited overtime|24\/7 availability)\b/i],
];
const SEVERE = [
  ['unpaid trial', /\bunpaid (trial|work trial|trial (week|period|project))\b/i],
  ['equity only', /\bequity[- ]only\b|\b(no|without) (base )?salary\b/i],
  ['commission only', /\bcommission[- ]only\b/i],
];

export function extractRedFlags(text, { hasSalary }) {
  const flags = RED_FLAGS.filter(([, re]) => re.test(text)).map(([label]) => label);
  if (!hasSalary && /\bcompetitive (salary|pay|compensation)\b/i.test(text)) flags.push('"competitive salary" with no number');
  const severe = SEVERE.filter(([, re]) => re.test(text)).map(([label]) => label);
  return { flags, severe };
}

export function extractRemote(job) {
  if (typeof job.remote === 'boolean') return job.remote;
  const where = `${job.location} ${job.description.slice(0, 600)}`;
  if (/\b(not remote|no remote|onsite only|on-site only|in[- ]office only)\b/i.test(where)) return false;
  return /\bremote\b/i.test(where) ? true : null;
}

// Remote, hybrid or on-site. This is a preference people filter on; it never affects the rating.
// Order of trust: an explicit "Location Type" label (Ashby), then the location field, then the text.
const HYBRID = /\bhybrid\b(?!\s+(cloud|apps?|mobile|infrastructure|architecture|environments?|search|model of care))|\b\d\s*(?:days?|x)\s*(?:a|per|\/)\s*week\s+(?:in|at)\s+(?:the\s+|our\s+)?office/i;
const ONSITE = /\b(on-?site|in[- ]office|in-person|office-based|fully in office|5 days (?:a|per) week in)\b/i;
const REMOTE = /\bremote\b/i;

function styleFrom(text) {
  if (!text) return null;
  if (HYBRID.test(text)) return 'hybrid';
  if (REMOTE.test(text) && !/\b(not remote|no remote|non-remote)\b/i.test(text)) return 'remote';
  if (ONSITE.test(text)) return 'onsite';
  return null;
}

export function extractWorkStyle(job) {
  const label = (job.description ?? '').match(/location type\s*[:\n]\s*(remote|hybrid|on-?site|in[- ]office)/i)?.[1];
  if (label) return /remote/i.test(label) ? 'remote' : /hybrid/i.test(label) ? 'hybrid' : 'onsite';
  const fromLocation = styleFrom(job.location);
  if (fromLocation) return fromLocation;
  if (job.remote === true) return 'remote';
  const fromText = styleFrom((job.description ?? '').slice(0, 2500));
  if (fromText) return fromText;
  return job.remote === false ? 'onsite' : null;
}

export function extractFacts(job) {
  const text = `${job.title}\n${job.description}`;
  const salary = job.salary ?? extractSalary(text);
  const { flags, severe } = extractRedFlags(text, { hasSalary: Boolean(salary) });
  return {
    salary,
    stack: extractStack(text),
    remote: extractRemote(job),
    workStyle: extractWorkStyle(job),
    rounds: extractRounds(text),
    interviewStyles: extractInterviewStyles(text),
    redFlags: flags,
    severeFlags: severe,
    extractedBy: 'rules',
  };
}
