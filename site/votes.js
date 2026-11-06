// "Rated by devs": anyone can rate a job on the Jobbie Scale. No accounts; each
// browser gets a random voter id. The listing's starting rating counts as one
// vote, and the community rating takes over once three devs have voted.
import { supabase } from '/supa.js';
import { LEVELS } from '/lib/score.js';

export const COMMUNITY_MIN_VOTES = 3;
const VOTER_KEY = 'fsj.voter';
const MINE_KEY = 'fsj.votes.v1';

function store(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Votes still count; we just won't remember which one you picked.
  }
}

function voterId() {
  let id = store(VOTER_KEY, null);
  if (!id) {
    id = crypto.randomUUID();
    save(VOTER_KEY, id);
  }
  return id;
}

export function myVote(jobId) {
  return store(MINE_KEY, {})[jobId];
}

// Map of jobId → { votes, avg } for jobs that have votes.
export async function fetchSummaries(jobIds) {
  const out = new Map();
  if (!jobIds.length) return out;
  const db = await supabase();
  for (let i = 0; i < jobIds.length; i += 500) {
    const { data, error } = await db.rpc('job_vote_summaries', { p_job_ids: jobIds.slice(i, i + 500) });
    if (error) throw error;
    for (const r of data ?? []) out.set(r.job_id, { votes: Number(r.votes), avg: Number(r.avg_level) });
  }
  return out;
}

export async function castVote(jobId, level) {
  const db = await supabase();
  const { data, error } = await db.rpc('cast_job_vote', { p_job_id: jobId, p_voter: voterId(), p_level: level });
  if (error) throw error;
  const mine = store(MINE_KEY, {});
  mine[jobId] = level;
  save(MINE_KEY, mine);
  const r = data?.[0];
  return r ? { votes: Number(r.votes), avg: Number(r.avg_level) } : null;
}

// The level a job is shown and filtered at.
export function effectiveLevel(job, summary) {
  if (!summary || summary.votes < COMMUNITY_MIN_VOTES) return job.rating.level;
  const blended = (job.rating.level + summary.avg * summary.votes) / (summary.votes + 1);
  return Math.max(0, Math.min(5, Math.round(blended)));
}

export function describeVotes(job, summary) {
  const n = summary?.votes ?? 0;
  if (n >= COMMUNITY_MIN_VOTES) {
    const lv = LEVELS[effectiveLevel(job, summary)];
    return `Devs say ${lv.name} ${lv.emoji} · ${n} votes`;
  }
  if (n > 0) return `${n} dev vote${n === 1 ? '' : 's'} so far · ${COMMUNITY_MIN_VOTES - n} more to override our sniff test`;
  return 'No dev votes yet. Be the first.';
}

// A row of six emoji buttons. onChange(summary) fires after a vote lands.
export function voteWidget(job, summary, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'vote';
  const label = document.createElement('p');
  label.className = 'vote-label';
  label.textContent = 'What would you rate it?';
  const row = document.createElement('div');
  row.className = 'vote-row';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', `Rate ${job.title} on the Jobbie Scale`);
  const status = document.createElement('p');
  status.className = 'vote-status';
  status.setAttribute('aria-live', 'polite');
  status.textContent = describeVotes(job, summary);

  const paint = () => {
    const mine = myVote(job.id);
    for (const b of row.children) b.setAttribute('aria-pressed', String(Number(b.dataset.level) === mine));
  };

  for (const lv of [...LEVELS].reverse()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.level = lv.level;
    b.textContent = lv.emoji;
    b.title = lv.name;
    b.setAttribute('aria-label', lv.name);
    b.addEventListener('click', async () => {
      row.querySelectorAll('button').forEach((x) => (x.disabled = true));
      try {
        const next = await castVote(job.id, lv.level);
        paint();
        status.textContent = `Thanks! ${describeVotes(job, next)}`;
        onChange?.(next);
      } catch (e) {
        status.textContent = /slow down/i.test(e?.message ?? '') ? 'Easy, tiger. Try again in a few minutes.' : "Your vote didn't go through. Try again in a moment.";
      } finally {
        row.querySelectorAll('button').forEach((x) => (x.disabled = false));
      }
    });
    row.append(b);
  }
  paint();
  wrap.append(label, row, status);
  return wrap;
}
