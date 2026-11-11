// Employer claims: a company states the pay range and interview process for its own job.
// Trust order for the interview process: candidates' interview reports, then the employer's
// statement, then what we read from the listing. Pay: the listing's, unless it has none.
import { STEPS, DURATIONS } from './reports.js';

const STEP_TO_STYLE = {
  live_algorithm: 'live_algorithm',
  take_home_paid: 'paid_take_home',
  take_home_unpaid: 'unpaid_take_home',
  pairing: 'pairing',
  team_chat: 'conversation',
};

// The newest approved claim for a job → what we store on the job and show on its page.
export function claimSummary(claim) {
  if (!claim) return null;
  const salary = claim.pay_min && claim.pay_max && claim.pay_currency && claim.pay_interval
    ? { min: claim.pay_min, max: claim.pay_max, currency: claim.pay_currency, interval: claim.pay_interval }
    : null;
  return {
    at: (claim.created_at ?? '').slice(0, 10),
    salary,
    workStyle: claim.work_style ?? null,
    steps: claim.steps ?? [],
    rounds: claim.rounds ?? null,
    duration: claim.duration ?? null,
  };
}

// Employer's word replaces our guesses from the listing, but never interview reports.
export function applyClaim(facts, stated) {
  if (!stated) return facts;
  const next = { ...facts, employerStated: true };
  if (!facts.salary && stated.salary) next.salary = stated.salary;
  if (stated.workStyle) next.workStyle = stated.workStyle;
  if (!facts.reportedBy) {
    if (stated.steps.length) next.interviewStyles = [...new Set(stated.steps.map((s) => STEP_TO_STYLE[s]).filter(Boolean))];
    if (stated.rounds) next.rounds = stated.rounds;
  }
  return next;
}

export function claimLines(stated) {
  if (!stated) return [];
  const lines = [];
  if (stated.rounds) lines.push(`${stated.rounds} round${stated.rounds === 1 ? '' : 's'}`);
  if (stated.duration) lines.push(`Takes ${DURATIONS[stated.duration].toLowerCase()}`);
  for (const s of stated.steps) if (STEPS[s]) lines.push(STEPS[s]);
  return lines;
}
