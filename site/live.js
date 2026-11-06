// Live emoji spam: tap an emoji and it floats up on everyone's screen.
// Uses Supabase Realtime "broadcast" (messages go straight to whoever is
// connected; nothing is stored) and "presence" (who is here right now).
// If Supabase can't be reached, your own taps still float, so it never looks broken.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '/config.js';

const EMOJIS = ['🚀', '💯', '😐', '🤢', '💩', '☠️'];
const SEND_EVERY_MS = 300;      // batch taps so a frantic tapper sends ~3 messages/sec, not 30
const MAX_TAPS_PER_SEC = 10;    // per person, so nobody floods everyone's screen
const MAX_FLOATERS = 45;        // per screen, so the page stays smooth
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const bar = document.getElementById('live-bar');
const countEl = document.getElementById('live-count');
if (bar) init();

function init() {
  const layer = document.createElement('div');
  layer.className = 'float-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  const pending = new Map();
  let tapTimes = [];
  let channel = null;

  for (const btn of bar.querySelectorAll('[data-emoji]')) {
    btn.addEventListener('click', () => {
      const now = performance.now();
      tapTimes = tapTimes.filter((t) => now - t < 1000);
      if (tapTimes.length >= MAX_TAPS_PER_SEC) {
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 300);
        return;
      }
      tapTimes.push(now);
      const emoji = btn.dataset.emoji;
      floatUp(layer, emoji, btn);
      pending.set(emoji, (pending.get(emoji) ?? 0) + 1);
      bump(btn);
    });
  }

  setInterval(() => {
    if (!pending.size || !channel) { pending.clear(); return; }
    const taps = Object.fromEntries(pending);
    pending.clear();
    channel.send({ type: 'broadcast', event: 'taps', payload: { taps } }).catch(() => {});
  }, SEND_EVERY_MS);

  connect()
    .then((ch) => {
      channel = ch;
    })
    .catch((e) => {
      console.info('Live emojis are local-only right now:', e?.message ?? e);
      setCount(1);
    });

  async function connect() {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
    const me = crypto.randomUUID?.() ?? String(Math.random());
    const ch = supabase.channel('hero-emojis', {
      config: { broadcast: { self: false }, presence: { key: me } },
    });

    ch.on('broadcast', { event: 'taps' }, ({ payload }) => {
      // Treat everything from the network as untrusted: known emojis only, small counts only.
      const taps = payload?.taps;
      if (!taps || typeof taps !== 'object') return;
      for (const [emoji, n] of Object.entries(taps)) {
        if (!EMOJIS.includes(emoji)) continue;
        const count = Math.max(0, Math.min(4, Math.floor(Number(n) || 0)));
        for (let i = 0; i < count; i++) setTimeout(() => floatUp(layer, emoji, null), i * 90 + Math.random() * 120);
      }
    });
    ch.on('presence', { event: 'sync' }, () => setCount(Object.keys(ch.presenceState()).length));

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out')), 10000);
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          await ch.track({ at: Date.now() });
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timer);
          reject(new Error(status));
        }
      });
    });
    return ch;
  }
}

function setCount(n) {
  if (!countEl) return;
  countEl.textContent = n <= 1 ? 'Just you sifting right now. Tap away.' : `${n} people sifting right now`;
}

function bump(btn) {
  btn.classList.remove('bump');
  void btn.offsetWidth; // restart the animation
  btn.classList.add('bump');
}

function floatUp(layer, emoji, fromButton) {
  if (layer.childElementCount >= MAX_FLOATERS) return;
  const el = document.createElement('span');
  el.className = 'floater';
  el.textContent = emoji;

  let x;
  let y;
  if (fromButton) {
    const r = fromButton.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top;
  } else {
    // Other people's taps rise from somewhere along the bottom of the screen.
    x = innerWidth * (0.08 + Math.random() * 0.84);
    y = innerHeight - 20;
  }
  const size = 28 + Math.random() * 22;
  const drift = (Math.random() - 0.5) * 160;
  const rise = Math.min(innerHeight * 0.75, 600) + Math.random() * 120;
  const spin = (Math.random() - 0.5) * 50;
  el.style.cssText = `left:${x}px;top:${y}px;font-size:${size}px`;
  layer.append(el);

  if (reduceMotion) {
    el.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 900 }).onfinish = () => el.remove();
    return;
  }
  el.animate(
    [
      { transform: 'translate(-50%, 0) scale(.6) rotate(0deg)', opacity: 0 },
      { transform: `translate(calc(-50% + ${drift * 0.3}px), -${rise * 0.15}px) scale(1.1) rotate(${spin * 0.3}deg)`, opacity: 1, offset: 0.12 },
      { transform: `translate(calc(-50% + ${drift}px), -${rise}px) scale(.9) rotate(${spin}deg)`, opacity: 0 },
    ],
    { duration: 2200 + Math.random() * 900, easing: 'cubic-bezier(.2,.7,.3,1)' },
  ).onfinish = () => el.remove();
}
