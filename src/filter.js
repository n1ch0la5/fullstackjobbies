// Free, code-only filters. These run before any AI so we only pay for the few
// listings that could actually make it onto the site.

const FULL_STACK = /\bfull[\s-]?stack\b|\bfullstack\b/i;
const SENIORITY_EXCLUDE = /\b(intern|internship|principal architect|director|vp|head of|manager)\b/i;

const NOT_A_JOB = /\b(phd|ph\.d|studentship|stipend|postdoc|fellowship|bootcamp)\b/i;

export function isFullStack(job) {
  if (SENIORITY_EXCLUDE.test(job.title)) return false;
  if (job.source === 'hn') {
    // HN posts are free text: the role must be a named full stack role, the company must be
    // known, and academic posts (PhDs, studentships) are out even if they mention full stack.
    const header = job.description.split('\n')[0] ?? '';
    if (NOT_A_JOB.test(header) || SENIORITY_EXCLUDE.test(header.replace(/engineering manager/i, ''))) return false;
    return FULL_STACK.test(job.title) && job.company !== 'Unknown';
  }
  return FULL_STACK.test(job.title);
}
