// Runs on job pages from Greenhouse, Lever, Ashby, Recruitee, Workable and SmartRecruiters.
// Finds the job text on the page and shows the rating badge. Nothing is sent anywhere.
(async () => {
  // These sites render the job with JavaScript, so wait until there's real text.
  const SELECTORS = [
    '#content', '.job__description', '.job-post', // Greenhouse
    '.posting-page', '.content-wrapper.posting-page', // Lever
    '[class*="_descriptionText"]', '[class*="_jobPosting"]', // Ashby
    '[data-ui="job-description"]', 'main', // Workable and others
    '.job-sections', '.jobad-main', // SmartRecruiters
    'article', 'body',
  ];
  const TITLE_SELECTORS = ['h1', '.posting-headline h2', '[class*="_title"]'];
  // Where hiring sites put location, compensation and remote status beside the description.
  const SIDE_SELECTORS = [
    '.ashby-job-posting-left-pane', // Ashby: Location, Location Type, Compensation
    '.job__location', '.job__header', // Greenhouse
    '.posting-categories', // Lever
    '[data-ui="job-location"]', '[data-ui="job-type"]', // Workable
  ];

  const sideText = () =>
    SIDE_SELECTORS.flatMap((s) => [...document.querySelectorAll(s)])
      .map((n) => n.innerText.trim())
      .filter(Boolean)
      .join('\n');

  function fromStructuredData() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent);
        const items = [data, ...(Array.isArray(data) ? data : []), ...(data['@graph'] ?? [])];
        const p = items.find((x) => x && x['@type'] === 'JobPosting');
        if (!p?.description) continue;
        // Parse without rendering, so nothing in the description can run or load.
        const body = new DOMParser().parseFromString(p.description, 'text/html').body.textContent;
        const v = p.baseSalary?.value ?? {};
        const min = Number(v.minValue ?? v.value);
        const max = Number(v.maxValue ?? v.value ?? v.minValue);
        const unit = String(v.unitText ?? 'YEAR').toUpperCase();
        const remote = p.jobLocationType === 'TELECOMMUTE';
        const where = [p.applicantLocationRequirements].flat().filter(Boolean).map((r) => r.name).filter(Boolean).join(', ');
        const place = [p.jobLocation].flat().filter(Boolean).map((l) => [l.address?.addressLocality, l.address?.addressRegion].filter(Boolean).join(', ')).filter(Boolean).join(' · ');
        return {
          title: p.title ?? '',
          text: `${p.title ?? ''}\n${sideText()}\n${body}`,
          location: remote ? `Remote${where ? ` (${where})` : ''}` : place,
          remote: remote || null,
          salary: min > 0 ? { min, max: max > 0 ? max : min, currency: p.baseSalary.currency ?? 'USD', interval: unit === 'HOUR' ? 'hour' : unit === 'MONTH' ? 'month' : 'year' } : null,
        };
      } catch {
        // ignore malformed data
      }
    }
    return null;
  }

  function readJob() {
    const structured = fromStructuredData();
    if (structured) return structured;
    const node = SELECTORS.map((s) => document.querySelector(s)).find((n) => n && n.innerText.trim().length > 400);
    const title = TITLE_SELECTORS.map((s) => document.querySelector(s)?.innerText?.trim()).find(Boolean) ?? document.title;
    return node ? { title, text: `${title}\n${sideText()}\n${node.innerText}` } : null;
  }

  // Only job detail pages, not a company's list of jobs.
  const looksLikeJob = () => /\/jobs?\/|\/o\/|\/j\/|[0-9a-f]{8}-[0-9a-f]{4}|\/\d{5,}/i.test(location.pathname);
  if (!looksLikeJob()) return;

  let job = null;
  for (let i = 0; i < 20 && !job; i++) {
    job = readJob();
    if (!job) await new Promise((r) => setTimeout(r, 500));
  }
  if (!job) return;

  const { showBadge } = await import(chrome.runtime.getURL('badge.js'));
  showBadge(job);
})();
