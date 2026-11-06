// Marks each page with whether this visitor needs to opt in to analytics,
// based on the country Netlify detects. EU/EEA, UK and Switzerland have to
// opt in; if the country is unknown we play it safe and ask too.
const ASK_FIRST = new Set([
  // EU
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // rest of the EEA, plus the UK and Switzerland
  'IS', 'LI', 'NO', 'GB', 'CH',
]);

export default async (request, context) => {
  const response = await context.next();
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response;

  const country = context.geo?.country?.code;
  const consent = !country || ASK_FIRST.has(country) ? 'required' : 'not-required';
  const html = (await response.text()).replace('<html lang="en">', `<html lang="en" data-consent="${consent}">`);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'public, max-age=0, must-revalidate');
  return new Response(html, { status: response.status, headers });
};

export const config = { path: ['/', '/index.html', '/jobs', '/jobs.html', '/thanks', '/thanks.html', '/agents', '/agents.html', '/privacy', '/privacy.html', '/job/*'] };
