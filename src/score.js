// The Jobbie Scale. A plain formula over extracted facts, so every rating can be
// explained line by line. Developer votes adjust it later on the site.

export const LEVELS = [
  { level: 0, name: 'Bloody mess', emoji: '☠️' },
  { level: 1, name: 'Steaming pile', emoji: '💩' },
  { level: 2, name: 'Bit whiffy', emoji: '🤢' },
  { level: 3, name: 'Meh', emoji: '😐' },
  { level: 4, name: 'Solid', emoji: '💯' },
  { level: 5, name: 'Rocket ship', emoji: '🚀' },
];

// Rough conversion so pay can be compared. Tune these occasionally; precision isn't the point.
const TO_USD = { USD: 1, CAD: 0.72, GBP: 1.27, EUR: 1.08, AUD: 0.65, NZD: 0.6, CHF: 1.13, SEK: 0.095, INR: 0.012 };
const PER_YEAR = { year: 1, month: 12, hour: 2080 };

export function annualUsd(salary) {
  if (!salary) return null;
  const rate = TO_USD[salary.currency] ?? null;
  if (rate === null) return null;
  const mult = PER_YEAR[salary.interval] ?? 1;
  return { min: salary.min * mult * rate, max: salary.max * mult * rate };
}

export function scoreJob(facts) {
  const reasons = [];
  const add = (points, why) => {
    score += points;
    reasons.push(`${points > 0 ? '+' : ''}${points} ${why}`);
  };
  // Calibrated on the first full sift (Nov 2026, 238 jobs) so roughly the top 10–15% reach
  // Rocket ship. Pay bands sit near that sample's median ($175k) and 75th percentile ($212k).
  // Being well paid alone tops out at Solid; a Rocket ship also needs remote or a humane,
  // stated interview process. Low pay is a mild knock, so fair non-US salaries aren't shamed.
  let score = 2.25;

  if (facts.severeFlags.length) {
    return finish(0, [`floor: ${facts.severeFlags.join(', ')}`]);
  }

  const pay = annualUsd(facts.salary);
  if (!facts.salary) add(-2, 'no salary');
  else if (pay) {
    const mid = (pay.min + pay.max) / 2;
    if (mid >= 210000) add(1.75, 'top-band pay');
    else if (mid >= 170000) add(1.25, 'strong pay');
    else if (mid >= 130000) add(0.5, 'decent pay');
    else if (mid < 70000) add(-0.5, 'low pay');
    if (pay.max > pay.min * 1.6) add(-0.5, 'suspiciously wide range');
  }

  if (facts.remote === true) add(0.5, 'remote');

  const styles = facts.interviewStyles;
  if (styles.includes('live_algorithm')) add(-1, 'live algorithm test');
  if (styles.includes('unpaid_take_home')) add(-0.5, 'unpaid take-home');
  if (styles.includes('paid_take_home')) add(0.5, 'paid take-home');
  if (styles.includes('pairing') || styles.includes('conversation')) add(0.75, 'humane interviews');

  if (facts.rounds !== null && facts.rounds !== undefined) {
    if (facts.rounds <= 3) add(0.5, `${facts.rounds} rounds`);
    else if (facts.rounds >= 5) add(-1, `${facts.rounds} rounds`);
  }

  if (facts.stack.length > 12) add(-0.5, 'kitchen-sink stack');

  const flagHit = Math.min(facts.redFlags.length * 0.5, 2.5);
  if (flagHit) add(-flagHit, `${facts.redFlags.length} red flag(s)`);

  // Being listed at all needs a salary; Level 0 is reserved for the severe stuff.
  return finish(Math.max(1, Math.min(5, Math.round(score))), reasons);
}

function finish(level, reasons) {
  return { ...LEVELS[level], reasons };
}
