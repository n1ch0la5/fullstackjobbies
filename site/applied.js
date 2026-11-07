// "I've applied" tracking. Saved only in this browser (no account needed),
// so it stays private but doesn't follow you to another device.
const KEY = 'fsj.applied.v1';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}
function write(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
    return true;
  } catch {
    return false; // private window or storage blocked
  }
}

export function appliedOn(jobId) {
  return read()[jobId] ?? null; // "YYYY-MM-DD" or null
}

export function setApplied(jobId, applied) {
  const map = read();
  if (applied) {
    const d = new Date();
    map[jobId] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } else {
    delete map[jobId];
  }
  return write(map);
}

export function appliedCount() {
  return Object.keys(read()).length;
}

// ---------- Dates ----------
// A plain date ("2026-11-06") is a calendar day; a timestamp is a moment. Either way,
// compare calendar days in the viewer's own time zone.
function localDay(value) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysSince(value) {
  const day = localDay(value);
  if (!day) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - day) / 86400000);
}

export function relative(value, verb) {
  const n = daysSince(value);
  if (n === null) return null;
  if (n <= 0) return `${verb} today`;
  if (n === 1) return `${verb} yesterday`;
  if (n < 60) return `${verb} ${n} days ago`;
  return `${verb} ${Math.round(n / 30)} months ago`;
}

export function shortDate(value) {
  const day = localDay(value);
  return day ? day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
}

// The button that marks a job as applied. onChange(isApplied) lets the page restyle the card.
export function appliedButton(jobId, onChange) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'applied-btn';
  const paint = () => {
    const on = appliedOn(jobId);
    btn.setAttribute('aria-pressed', String(Boolean(on)));
    btn.textContent = on ? `✓ Applied ${shortDate(on)}` : 'Mark as applied';
    btn.title = on ? 'Click to unmark' : 'Only you can see this. It is saved in this browser.';
  };
  btn.addEventListener('click', () => {
    const next = !appliedOn(jobId);
    if (!setApplied(jobId, next)) {
      btn.textContent = "Can't save in this browser";
      return;
    }
    paint();
    onChange?.(next, btn);
  });
  paint();
  return btn;
}
