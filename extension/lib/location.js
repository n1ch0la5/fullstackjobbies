// Where can you work this job from? Turns messy location text ("Remote (US)",
// "Toronto, ON", "Remote, EMEA", "SF / NYC / Remote") into country codes,
// regions and a work-from-anywhere flag. Plain code, no AI, runs on every job.
// Shared with the browser so the jobs page can list the same countries.

export const REGIONS = {
  NA: 'North America',
  LATAM: 'Latin America',
  EMEA: 'Europe, Middle East & Africa',
  APAC: 'Asia-Pacific',
};

// code, name, region, extra words that mean this country (cities, states, abbreviations).
// Words in UPPERCASE_ONLY are matched case-sensitively so "us" or "can" in prose don't count.
export const COUNTRIES = [
  { code: 'US', name: 'United States', region: 'NA', flag: '🇺🇸', words: ['united states', 'usa', 'u.s.', 'u.s.a.', 'san francisco', 'sf bay area', 'bay area', 'new york', 'nyc', 'seattle', 'austin', 'boston', 'chicago', 'los angeles', 'denver', 'atlanta', 'miami', 'san diego', 'san jose', 'palo alto', 'mountain view', 'menlo park', 'washington, dc', 'washington dc', 'philadelphia', 'pittsburgh', 'portland, or', 'salt lake city', 'nashville', 'raleigh', 'dallas', 'houston', 'phoenix', 'minneapolis', 'detroit', 'boulder', 'brooklyn', 'oakland', 'california', 'texas', 'florida', 'colorado', 'massachusetts', 'illinois', 'virginia', 'washington state', 'oregon', 'utah', 'arizona', 'north carolina', 'pennsylvania', 'michigan', 'minnesota', 'tennessee', 'ohio', 'maryland', 'new jersey', 'us time zones', 'us timezones', 'eastern time', 'pacific time', 'central time', 'mountain time'], caps: ['US', 'USA', 'EST', 'PST', 'CST', 'MST', 'EDT', 'PDT'] },
  { code: 'CA', name: 'Canada', region: 'NA', flag: '🇨🇦', words: ['canada', 'canadian', 'toronto', 'vancouver', 'montreal', 'montréal', 'calgary', 'ottawa', 'waterloo', 'edmonton', 'winnipeg', 'halifax', 'ontario', 'british columbia', 'quebec', 'québec', 'alberta'], caps: ['CAN'] },
  { code: 'MX', name: 'Mexico', region: 'LATAM', flag: '🇲🇽', words: ['mexico', 'méxico', 'guadalajara', 'monterrey'] },
  { code: 'BR', name: 'Brazil', region: 'LATAM', flag: '🇧🇷', words: ['brazil', 'brasil', 'são paulo', 'sao paulo', 'rio de janeiro'] },
  { code: 'AR', name: 'Argentina', region: 'LATAM', flag: '🇦🇷', words: ['argentina', 'buenos aires'] },
  { code: 'CO', name: 'Colombia', region: 'LATAM', flag: '🇨🇴', words: ['colombia', 'bogotá', 'bogota', 'medellín', 'medellin'] },
  { code: 'CL', name: 'Chile', region: 'LATAM', flag: '🇨🇱', words: ['chile', 'santiago'] },
  { code: 'GB', name: 'United Kingdom', region: 'EMEA', flag: '🇬🇧', words: ['united kingdom', 'england', 'scotland', 'wales', 'northern ireland', 'london', 'manchester', 'edinburgh', 'glasgow', 'bristol', 'cambridge, uk', 'oxford', 'leeds', 'birmingham, uk'], caps: ['UK', 'GMT', 'BST'] },
  { code: 'IE', name: 'Ireland', region: 'EMEA', flag: '🇮🇪', words: ['ireland', 'dublin', 'cork'] },
  { code: 'DE', name: 'Germany', region: 'EMEA', flag: '🇩🇪', words: ['germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln'] },
  { code: 'FR', name: 'France', region: 'EMEA', flag: '🇫🇷', words: ['france', 'paris', 'lyon'] },
  { code: 'NL', name: 'Netherlands', region: 'EMEA', flag: '🇳🇱', words: ['netherlands', 'the netherlands', 'holland', 'amsterdam', 'rotterdam', 'utrecht'] },
  { code: 'BE', name: 'Belgium', region: 'EMEA', flag: '🇧🇪', words: ['belgium', 'brussels', 'antwerp'] },
  { code: 'ES', name: 'Spain', region: 'EMEA', flag: '🇪🇸', words: ['spain', 'españa', 'madrid', 'barcelona', 'valencia'] },
  { code: 'PT', name: 'Portugal', region: 'EMEA', flag: '🇵🇹', words: ['portugal', 'lisbon', 'lisboa', 'porto'] },
  { code: 'IT', name: 'Italy', region: 'EMEA', flag: '🇮🇹', words: ['italy', 'italia', 'milan', 'milano', 'rome'] },
  { code: 'CH', name: 'Switzerland', region: 'EMEA', flag: '🇨🇭', words: ['switzerland', 'zurich', 'zürich', 'geneva', 'lausanne'] },
  { code: 'AT', name: 'Austria', region: 'EMEA', flag: '🇦🇹', words: ['austria', 'vienna', 'wien'] },
  { code: 'SE', name: 'Sweden', region: 'EMEA', flag: '🇸🇪', words: ['sweden', 'stockholm', 'gothenburg'] },
  { code: 'DK', name: 'Denmark', region: 'EMEA', flag: '🇩🇰', words: ['denmark', 'copenhagen'] },
  { code: 'NO', name: 'Norway', region: 'EMEA', flag: '🇳🇴', words: ['norway', 'oslo'] },
  { code: 'FI', name: 'Finland', region: 'EMEA', flag: '🇫🇮', words: ['finland', 'helsinki'] },
  { code: 'PL', name: 'Poland', region: 'EMEA', flag: '🇵🇱', words: ['poland', 'warsaw', 'kraków', 'krakow', 'wrocław', 'wroclaw'] },
  { code: 'CZ', name: 'Czechia', region: 'EMEA', flag: '🇨🇿', words: ['czechia', 'czech republic', 'prague'] },
  { code: 'EE', name: 'Estonia', region: 'EMEA', flag: '🇪🇪', words: ['estonia', 'tallinn'] },
  { code: 'RO', name: 'Romania', region: 'EMEA', flag: '🇷🇴', words: ['romania', 'bucharest', 'cluj'] },
  { code: 'GR', name: 'Greece', region: 'EMEA', flag: '🇬🇷', words: ['greece', 'athens'] },
  { code: 'IL', name: 'Israel', region: 'EMEA', flag: '🇮🇱', words: ['israel', 'tel aviv'] },
  { code: 'AE', name: 'United Arab Emirates', region: 'EMEA', flag: '🇦🇪', words: ['united arab emirates', 'dubai', 'abu dhabi'], caps: ['UAE'] },
  { code: 'ZA', name: 'South Africa', region: 'EMEA', flag: '🇿🇦', words: ['south africa', 'cape town', 'johannesburg'] },
  { code: 'NG', name: 'Nigeria', region: 'EMEA', flag: '🇳🇬', words: ['nigeria', 'lagos'] },
  { code: 'KE', name: 'Kenya', region: 'EMEA', flag: '🇰🇪', words: ['kenya', 'nairobi'] },
  { code: 'IN', name: 'India', region: 'APAC', flag: '🇮🇳', words: ['india', 'bangalore', 'bengaluru', 'hyderabad', 'pune', 'mumbai', 'delhi', 'gurgaon', 'gurugram', 'noida', 'chennai'], caps: ['IST'] },
  { code: 'SG', name: 'Singapore', region: 'APAC', flag: '🇸🇬', words: ['singapore'] },
  { code: 'JP', name: 'Japan', region: 'APAC', flag: '🇯🇵', words: ['japan', 'tokyo', 'osaka'] },
  { code: 'KR', name: 'South Korea', region: 'APAC', flag: '🇰🇷', words: ['south korea', 'korea', 'seoul'] },
  { code: 'HK', name: 'Hong Kong', region: 'APAC', flag: '🇭🇰', words: ['hong kong'] },
  { code: 'PH', name: 'Philippines', region: 'APAC', flag: '🇵🇭', words: ['philippines', 'manila'] },
  { code: 'VN', name: 'Vietnam', region: 'APAC', flag: '🇻🇳', words: ['vietnam', 'ho chi minh', 'hanoi'] },
  { code: 'ID', name: 'Indonesia', region: 'APAC', flag: '🇮🇩', words: ['indonesia', 'jakarta', 'bali'] },
  { code: 'AU', name: 'Australia', region: 'APAC', flag: '🇦🇺', words: ['australia', 'sydney', 'melbourne', 'brisbane', 'perth'], caps: ['AEST'] },
  { code: 'NZ', name: 'New Zealand', region: 'APAC', flag: '🇳🇿', words: ['new zealand', 'auckland', 'wellington'] },
];

// US state codes after a comma ("Austin, TX") and Canadian provinces ("Toronto, ON").
const US_STATES = 'AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY';
const CA_PROVINCES = 'ON|BC|QC|AB|MB|SK|NS|NB|NL|PE';
const US_STATE_RE = new RegExp(`,\\s*(${US_STATES})\\b(?!\\s*\\d)`);
const CA_PROV_RE = new RegExp(`,\\s*(${CA_PROVINCES})\\b`);

const REGION_WORDS = [
  [/\bnorth america(n)?\b/i, ['NA']],
  [/\b(the )?americas\b/i, ['NA', 'LATAM']],
  [/\b(latam|latin america|south america)\b/i, ['LATAM']],
  [/\bemea\b/i, ['EMEA']],
  [/\b(europe|european|eu time ?zones?|cet|cest)\b/i, ['EMEA']],
  [/\bEU\b/, ['EMEA']],
  [/\b(apac|asia[- ]pacific|asia)\b/i, ['APAC']],
];
const ANYWHERE = /\b(worldwide|anywhere in the world|work from anywhere|remote[- ]anywhere|anywhere|global(ly)? remote|fully distributed|any time ?zone|all time ?zones)\b/i;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MATCHERS = COUNTRIES.map((c) => ({
  code: c.code,
  re: new RegExp(`(^|[^\\p{L}])(${c.words.map(escapeRe).join('|')})(?=[^\\p{L}]|$)`, 'iu'),
  caps: c.caps ? new RegExp(`\\b(${c.caps.join('|')})\\b`) : null,
}));

// Only look where location actually gets stated, not at "we have an office in London" deep in the copy.
function locationText(job) {
  const lines = (job.description ?? '').split('\n');
  const hints = lines
    .filter((l) => /remote|time ?zones?|based in|located in|location|must (live|reside|be)|authori[sz]ed to work|work from|hybrid|on-?site|office/i.test(l))
    .slice(0, 6)
    .map((l) => l.slice(0, 300));
  const firstLine = job.source === 'hn' ? lines[0] ?? '' : '';
  return [job.location ?? '', firstLine, ...hints].join('\n');
}

export function classifyLocation(job) {
  const primary = `${job.location ?? ''}\n${job.source === 'hn' ? (job.description ?? '').split('\n')[0] : ''}`;
  const text = locationText(job);
  const countries = new Set();
  const regions = new Set();

  // Countries named in the location field itself are the strongest signal; fall back to the hints.
  for (const scope of [primary, text]) {
    for (const m of MATCHERS) if (m.re.test(scope) || m.caps?.test(scope)) countries.add(m.code);
    if (US_STATE_RE.test(scope)) countries.add('US');
    if (CA_PROV_RE.test(scope)) countries.add('CA');
    for (const [re, rs] of REGION_WORDS) if (re.test(scope)) rs.forEach((r) => regions.add(r));
    if (countries.size || regions.size) break;
  }
  const anywhere = ANYWHERE.test(primary) || (!countries.size && !regions.size && ANYWHERE.test(text));

  return { countries: [...countries].sort(), regions: [...regions].sort(), anywhere };
}

const BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

// Does a job fit where this person can work?
//   picked: country codes, e.g. ['US', 'CA']
//   includeAnywhere: count "work from anywhere" jobs
//   includeUnstated: count remote jobs that don't say where
export function jobFitsWhere(where, picked, { includeAnywhere = true, includeUnstated = true } = {}) {
  if (!picked?.length) return true;
  if (!where) return includeUnstated;
  if (where.countries.some((c) => picked.includes(c))) return true;
  const pickedRegions = new Set(picked.map((c) => BY_CODE[c]?.region).filter(Boolean));
  if (where.regions.some((r) => pickedRegions.has(r))) return true;
  if (where.anywhere) return includeAnywhere;
  if (!where.countries.length && !where.regions.length) return includeUnstated;
  return false;
}

export function describeWhere(where) {
  if (!where) return '';
  const parts = [
    ...where.countries.map((c) => `${BY_CODE[c]?.flag ?? ''} ${BY_CODE[c]?.name ?? c}`.trim()),
    ...where.regions.map((r) => REGIONS[r] ?? r),
  ];
  if (where.anywhere) parts.push('🌍 Anywhere');
  return parts.join(' · ');
}
