// Your preferences, and how a job fits them. Saved in Chrome's own sync storage
// (your Google account, if Chrome sync is on), never sent to Full Stack Jobbies.
// None of this changes the Jobbie rating: the rating is the same for everyone,
// the fit check is just for you.
import { annualUsd } from './lib/score.js';
import { classifyLocation, jobFitsWhere, describeWhere, COUNTRIES } from './lib/location.js';

export const WORK_STYLES = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };
export const AVOIDABLE = { live_algorithm: 'Live algorithm tests', unpaid_take_home: 'Unpaid take-homes', take_home: 'Any take-home' };
const AVOID_HEAD = { live_algorithm: 'Live algorithm test', unpaid_take_home: 'Unpaid take-home', take_home: 'Take-home' };
export const CURRENCIES = ['USD', 'CAD', 'GBP', 'EUR', 'AUD'];

export const DEFAULTS = {
  workStyles: [], // empty = no preference
  salaryFloor: { amount: 0, currency: 'USD' },
  countries: [],
  avoid: [],
  startCollapsed: false,
};

export async function loadPrefs() {
  try {
    const { prefs } = await chrome.storage.sync.get('prefs');
    return { ...DEFAULTS, ...(prefs ?? {}), salaryFloor: { ...DEFAULTS.salaryFloor, ...(prefs?.salaryFloor ?? {}) } };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function savePrefs(prefs) {
  await chrome.storage.sync.set({ prefs });
}

export function hasPrefs(p) {
  return Boolean(p.workStyles.length || p.salaryFloor.amount > 0 || p.countries.length || p.avoid.length);
}

const SYM = { USD: '$', CAD: 'CA$', GBP: '£', EUR: '€', AUD: 'A$' };
const money = (n, cur) => `${SYM[cur] ?? `${cur} `}${n >= 1000 ? `${Math.round(n / 1000)}k` : n}`;
const FLAG = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.flag]));
const list = (xs) => (xs.length <= 2 ? xs.join(' or ') : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);

// Returns { fits: string[], heads: string[] } for the card's "Fits you / Heads up" lines.
export function fitCheck(facts, job, prefs) {
  const fits = [];
  const heads = [];

  if (prefs.workStyles.length) {
    const wanted = prefs.workStyles.map((w) => WORK_STYLES[w]);
    if (!facts.workStyle) heads.push(`Doesn't say remote, hybrid or on-site`);
    else if (prefs.workStyles.includes(facts.workStyle)) fits.push(WORK_STYLES[facts.workStyle]);
    else heads.push(`${WORK_STYLES[facts.workStyle]} (you want ${list(wanted)})`);
  }

  const floor = prefs.salaryFloor;
  if (floor.amount > 0) {
    const floorUsd = annualUsd({ min: floor.amount, max: floor.amount, currency: floor.currency, interval: 'year' })?.min;
    const pay = annualUsd(facts.salary);
    if (!facts.salary) heads.push('No salary listed');
    else if (!pay || !floorUsd) heads.push(`Pay is in ${facts.salary.currency}; can't compare to your floor`);
    else if (pay.max < floorUsd) heads.push(`Tops out under your ${money(floor.amount, floor.currency)} floor`);
    else if (pay.min >= floorUsd) fits.push(`Above your ${money(floor.amount, floor.currency)} floor`);
    else fits.push(`Range reaches your ${money(floor.amount, floor.currency)} floor`);
  }

  if (prefs.countries.length) {
    const where = classifyLocation({ location: job.location ?? '', description: job.text ?? '', source: 'page' });
    const stated = where.countries.length || where.regions.length || where.anywhere;
    if (stated) {
      if (jobFitsWhere(where, prefs.countries, { includeAnywhere: true, includeUnstated: true })) {
        fits.push(where.anywhere && !where.countries.length ? 'Open to anywhere' : `Open to ${prefs.countries.filter((c) => where.countries.includes(c)).map((c) => FLAG[c]).join(' ') || describeWhere(where)}`);
      } else {
        heads.push(`Open to ${describeWhere(where)}, not where you are`);
      }
    }
  }

  for (const style of prefs.avoid) {
    const hit = style === 'take_home'
      ? facts.interviewStyles.some((s) => s.includes('take_home'))
      : facts.interviewStyles.includes(style);
    if (hit) heads.push(`${AVOID_HEAD[style]} (you avoid these)`);
  }

  return { fits, heads };
}
