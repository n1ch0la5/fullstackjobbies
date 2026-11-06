// Tiny fetch wrapper: JSON, a timeout, and a polite User-Agent.
const UA = 'fullstackjobbies-sifter/0.1 (+https://fullstackjobbies.com)';

export async function getJson(url, { timeoutMs = 20000 } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} for ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Small concurrency limiter so we never hammer anyone's API.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
