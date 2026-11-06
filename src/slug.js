// Readable, stable URLs for job pages: /jobs/gitlab-senior-full-stack-engineer-k3x9q2
export function slugify(s = '') {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

// FNV-1a: a tiny stable hash so two "Full Stack Engineer" jobs at one company get different URLs.
function shortHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(6, '0').slice(-6);
}

export function jobSlug(job) {
  return [slugify(job.company), slugify(job.title), shortHash(job.id)].filter(Boolean).join('-');
}
