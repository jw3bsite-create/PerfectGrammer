// Normalisierung getippter Antworten.
// Ausgeglichen werden nur Leerzeichen (doppelte, geschützte, am Rand) und die Form der Anführungszeichen.

const SPACE_RE = /[\s  -​  　]+/g;
const DOUBLE_QUOTES_RE = /[„“”"«»‟]/g;
const SINGLE_QUOTES_RE = /[‚‘’'‹›‛`´]/g;

export function normalizeSpaces(s: string): string {
  return s.replace(SPACE_RE, ' ').trim();
}

export function normalizeQuotes(s: string): string {
  return s.replace(DOUBLE_QUOTES_RE, '"').replace(SINGLE_QUOTES_RE, "'");
}

export function normalizeAnswer(s: string): string {
  return normalizeQuotes(normalizeSpaces(s));
}

/** Entfernt Leerzeichen vor Satzzeichen, wie sie beim Zusammensetzen einzelner Wörter entstehen. */
export function tidyPunctuation(s: string): string {
  return normalizeSpaces(s).replace(/\s+([,.;:!?)\]“‘])/g, '$1').replace(/([„‚(\[])\s+/g, '$1');
}

export function sameAnswer(a: string, b: string): boolean {
  return normalizeAnswer(a) === normalizeAnswer(b);
}

const ABKUERZUNGEN = ['z. B.', 'Z. B.', 'd. h.', 'D. h.', 'u. a.', 'o. Ä.', 'u. Ä.', 's. o.', 's. u.', 'v. a.', 'z. T.', 'u. U.', 'i. d. R.', 'm. E.'];

/** Setzt für die Anzeige schmale geschützte Leerzeichen in Abkürzungen und geschützte Leerzeichen bei Belegen. */
export function typo(s: string): string {
  let out = s;
  for (const a of ABKUERZUNGEN) {
    if (out.includes(a)) out = out.split(a).join(a.replace(/\. /g, '.\u202f'));
  }
  return out.replace(/\b([ZSV])\. (\d)/g, '$1.\u00a0$2');
}
