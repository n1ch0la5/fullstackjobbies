// HTML → plain text, good enough for job descriptions.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#x2F': '/' };

export function decodeEntities(s = '') {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9#]+);/gi, (m, name) => ENTITIES[name] ?? m);
}

export function htmlToText(html = '') {
  // Greenhouse double-escapes its HTML, so decode first, then strip tags, then decode again.
  const once = decodeEntities(html);
  return decodeEntities(
    once
      .replace(/<(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

// Stable short hash so we only re-rate a listing when its text changes.
import { createHash } from 'node:crypto';
export function hash(s) {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}
