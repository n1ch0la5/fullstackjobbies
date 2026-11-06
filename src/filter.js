// Free, code-only filters. These run before any AI so we only pay for the few
// listings that could actually make it onto the site.

const FULL_STACK = /\bfull[\s-]?stack\b|\bfullstack\b/i;
const SENIORITY_EXCLUDE = /\b(intern|internship|principal architect|director|vp|head of|manager)\b/i;

export function isFullStack(job) {
  if (SENIORITY_EXCLUDE.test(job.title)) return false;
  if (FULL_STACK.test(job.title)) return true;
  // HN posts put the role in the first line rather than a clean title field.
  if (job.source === 'hn') return FULL_STACK.test(job.description.slice(0, 400));
  return false;
}
