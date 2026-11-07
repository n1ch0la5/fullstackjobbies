// Interview reports: what people who actually interviewed tell us. Fixed choices only
// (no free text), so reports describe the process without anyone trashing a company.
// Shared by the sifter, the report form and job pages. The same lists are enforced in
// supabase/reports.sql; change both together.

export const STAGES = {
  applied: 'Applied',
  recruiter: 'Talked to a recruiter',
  interviewed: 'Interviewed',
  offer: 'Got an offer',
};

export const STEPS = {
  recruiter_call: 'Recruiter call',
  live_algorithm: 'Live algorithm test',
  take_home_paid: 'Paid take-home',
  take_home_unpaid: 'Unpaid take-home',
  pairing: 'Pair on real work',
  system_design: 'System design',
  team_chat: 'Talk with the team',
  behavioral: 'Behavioral questions',
};

export const DURATIONS = {
  under_2w: 'Under 2 weeks',
  '2_4w': '2 to 4 weeks',
  '1_2m': '1 to 2 months',
  over_2m: 'Over 2 months',
};

export const TAGS = {
  respected_time: 'Respected my time',
  clear_steps: 'Clear next steps',
  prepared: 'Prepared interviewers',
  gave_feedback: 'Gave feedback',
  ghosted: 'Ghosted me',
  moved_goalposts: 'Moved the goalposts',
  pay_changed: 'Pay changed late',
};
export const GOOD_TAGS = ['respected_time', 'clear_steps', 'prepared', 'gave_feedback'];

// Report steps that mean the same thing as the interview styles we read from listings.
const STEP_TO_STYLE = {
  live_algorithm: 'live_algorithm',
  take_home_paid: 'paid_take_home',
  take_home_unpaid: 'unpaid_take_home',
  pairing: 'pairing',
  team_chat: 'conversation',
};

const countOf = (lists) => {
  const out = {};
  for (const list of lists) for (const v of list ?? []) out[v] = (out[v] ?? 0) + 1;
  return out;
};
const median = (nums) => {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
};

// Approved reports for one job → what the site shows and the rating uses.
export function summarizeReports(reports) {
  const interviewed = reports.filter((r) => r.stage === 'interviewed' || r.stage === 'offer');
  const durations = countOf(reports.map((r) => (r.duration ? [r.duration] : [])));
  const duration = Object.entries(durations).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const upfront = reports.filter((r) => r.salary_upfront !== null && r.salary_upfront !== undefined);
  return {
    count: reports.length,
    interviewed: interviewed.length,
    steps: countOf(reports.map((r) => r.steps)),
    rounds: median(reports.map((r) => r.rounds).filter((n) => Number.isInteger(n) && n > 0)),
    duration,
    salaryUpfront: { yes: upfront.filter((r) => r.salary_upfront).length, no: upfront.filter((r) => !r.salary_upfront).length },
    tags: countOf(reports.map((r) => r.tags)),
  };
}

// People who went through it know better than our guesses from the listing: a step that at
// least half of the reports mention replaces what we read, and so does the reported rounds.
// Only reports from people who got to the interviews count toward this.
export function applyReports(facts, summary) {
  if (!summary?.interviewed) return facts;
  const half = Math.ceil(summary.interviewed / 2);
  const styles = Object.entries(summary.steps)
    .filter(([step, n]) => n >= half && STEP_TO_STYLE[step])
    .map(([step]) => STEP_TO_STYLE[step]);
  return {
    ...facts,
    interviewStyles: [...new Set(styles)],
    rounds: summary.rounds ?? facts.rounds,
    reportedBy: summary.interviewed,
  };
}

// Short lines for a job page: "3 rounds", "Pair on real work (2 of 2)", …
export function reportLines(summary) {
  if (!summary?.count) return [];
  const of = (n) => (summary.count > 1 ? ` (${n} of ${summary.count})` : '');
  const lines = [];
  if (summary.rounds) lines.push(`${summary.rounds} round${summary.rounds === 1 ? '' : 's'}`);
  if (summary.duration) lines.push(`Took ${DURATIONS[summary.duration].toLowerCase()}`);
  for (const [step, n] of Object.entries(summary.steps)) if (STEPS[step]) lines.push(`${STEPS[step]}${of(n)}`);
  const { yes, no } = summary.salaryUpfront;
  if (yes || no) lines.push(yes >= no ? `Salary discussed up front${of(yes)}` : `Salary not discussed up front${of(no)}`);
  for (const [tag, n] of Object.entries(summary.tags)) if (TAGS[tag]) lines.push(`${TAGS[tag]}${of(n)}`);
  return lines;
}
