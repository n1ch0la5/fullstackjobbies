// Turn board slugs like "duck-duck-go" or "proxima_fusion" into names people recognise.
import { getJson } from './http.js';

const UPPER = new Set(['ai', 'io', 'hq', 'ml', 'api', 'ui', 'ux', 'vr', 'ar', 'xr', 'us', 'uk', 'eu', 'ev', 'hr', 'it', 'qa', 'sf', 'nyc', 'b2b', 'saas']);
const KNOWN = {
  'duck-duck-go': 'DuckDuckGo',
  duckduckgo: 'DuckDuckGo',
  gitlab: 'GitLab',
  github: 'GitHub',
  posthog: 'PostHog',
  openai: 'OpenAI',
  hubspot: 'HubSpot',
  doordash: 'DoorDash',
  mongodb: 'MongoDB',
  sentilink: 'SentiLink',
  creditgenie: 'Credit Genie',
  thundercompute: 'Thunder Compute',
  controlplane: 'Control Plane',
  apolloresearch: 'Apollo Research',
  getduranta: 'Duranta',
  justworks: 'Justworks',
  iceye: 'ICEYE',
};

export function prettifySlug(slug = '') {
  const key = slug.toLowerCase();
  if (KNOWN[key]) return KNOWN[key];
  return key
    .replace(/^(get|join|try|work-?at)-?(?=[a-z]{3,})/, '') // getfoo → foo
    .replace(/-?(inc|llc|ltd|careers|jobs|hq)$/, (m) => (m.includes('hq') ? m : ''))
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((w) => (UPPER.has(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

// A display name still equal to its slug was never looked up or tidied.
export function needsName(company) {
  return !company.name || company.name === company.slug;
}

// Greenhouse boards publish the company's real name; other systems don't, so we tidy the slug.
export async function lookUpName(company) {
  if (company.ats === 'greenhouse') {
    try {
      const board = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.slug)}`);
      if (board?.name) return board.name;
    } catch {
      // fall through to the tidy slug
    }
  }
  return prettifySlug(company.slug);
}
