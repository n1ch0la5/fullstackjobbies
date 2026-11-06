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

  function readJob() {
    // Prefer structured data when the page has it.
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent);
        const items = [data, ...(Array.isArray(data) ? data : []), ...(data['@graph'] ?? [])];
        const p = items.find((x) => x && x['@type'] === 'JobPosting');
        if (p?.description) {
          // Parse without rendering, so nothing in the description can run or load.
          const div = new DOMParser().parseFromString(p.description, 'text/html').body;
          const sal = p.baseSalary?.value;
          const salaryLine = sal?.minValue ? `\nSalary: ${p.baseSalary.currency ?? 'USD'} ${sal.minValue} - ${sal.maxValue ?? sal.minValue}` : '';
          return { title: p.title ?? '', text: `${p.title ?? ''}\n${div.textContent}${salaryLine}` };
        }
      } catch {
        // ignore malformed data
      }
    }
    const node = SELECTORS.map((s) => document.querySelector(s)).find((n) => n && n.innerText.trim().length > 400);
    const title = TITLE_SELECTORS.map((s) => document.querySelector(s)?.innerText?.trim()).find(Boolean) ?? document.title;
    return node ? { title, text: `${title}\n${node.innerText}` } : null;
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
