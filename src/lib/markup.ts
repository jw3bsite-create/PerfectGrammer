// Parser für die Aufgaben-Notationen.

// ---------- Komma-Notation ----------
// Wörter durch Leerzeichen getrennt. {Wort} markiert ein gebeugtes Verb.
// „,“ am Wortende = Pflichtkomma, „(,)“ am Wortende = freigestelltes Komma.

export type GapExpect = 'ja' | 'nein' | 'frei';

export interface KommaToken {
  text: string;
  verb: boolean;
}

export interface ParsedKomma {
  tokens: KommaToken[];
  /** Erwartung für die Lücke nach Token i (Länge tokens.length - 1). */
  gaps: GapExpect[];
}

export function parseKomma(src: string): ParsedKomma {
  const raw = src.trim().split(/\s+/);
  const tokens: KommaToken[] = [];
  const gaps: GapExpect[] = [];
  raw.forEach((w, i) => {
    let word = w;
    let gap: GapExpect = 'nein';
    if (word.endsWith('(,)')) {
      gap = 'frei';
      word = word.slice(0, -3);
    } else if (word.endsWith(',')) {
      gap = 'ja';
      word = word.slice(0, -1);
    }
    const verb = /\{[^}]*\}/.test(word);
    word = word.replace(/[{}]/g, '');
    tokens.push({ text: word, verb });
    if (i < raw.length - 1) gaps.push(gap);
    else if (gap !== 'nein') throw new Error(`Komma am Satzende: ${src}`);
  });
  return { tokens, gaps };
}

/** Satz mit den Kommas des Nutzers. */
export function kommaSentence(tokens: KommaToken[], commas: boolean[]): string {
  return tokens.map((t, i) => t.text + (i < commas.length && commas[i] ? ',' : '')).join(' ');
}

/** Lösungssatz; freigestellte Kommas als „(,)“, wenn markOptional gesetzt ist. */
export function kommaSolution(p: ParsedKomma, markOptional = false): string {
  return p.tokens
    .map((t, i) => {
      const g = p.gaps[i];
      if (g === 'ja') return t.text + ',';
      if (g === 'frei') return t.text + (markOptional ? '(,)' : '');
      return t.text;
    })
    .join(' ');
}

export function plainKomma(src: string): string {
  return kommaSolution(parseKomma(src));
}

// ---------- Fehler-Notation ----------
// [[falsch=>richtig|fehlertyp|Begründung]]

export interface MarkupError {
  falsch: string;
  richtig: string;
  fehlertyp?: string;
  begruendung?: string;
  /** Zeichenposition im Originaltext. */
  start: number;
  end: number;
}

export interface Segment {
  kind: 'text' | 'fehler';
  falsch: string;
  richtig: string;
  fehler?: MarkupError;
}

export interface ParsedFehler {
  original: string;
  loesung: string;
  segments: Segment[];
  fehler: MarkupError[];
}

/** [[falsch=>richtig|typ|Begründung]] – „richtig“ enthält kein „|“, keine Stelle enthält „]]“. */
export const ERR_SRC = String.raw`\[\[((?:(?!\]\]|=>)[\s\S])*?)=>((?:(?!\]\]|\|)[\s\S])*?)(?:\|([^|\]]*))?(?:\|((?:(?!\]\])[\s\S])*))?\]\]`;
const ERR_RE = new RegExp(ERR_SRC, 'g');

export function parseFehler(src: string): ParsedFehler {
  const segments: Segment[] = [];
  const fehler: MarkupError[] = [];
  let original = '';
  let loesung = '';
  let last = 0;
  ERR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ERR_RE.exec(src))) {
    const before = src.slice(last, m.index);
    if (before) {
      segments.push({ kind: 'text', falsch: before, richtig: before });
      original += before;
      loesung += before;
    }
    const e: MarkupError = {
      falsch: m[1],
      richtig: m[2],
      fehlertyp: m[3]?.trim() || undefined,
      begruendung: m[4]?.trim() || undefined,
      start: original.length,
      end: original.length + m[1].length,
    };
    segments.push({ kind: 'fehler', falsch: m[1], richtig: m[2], fehler: e });
    fehler.push(e);
    original += m[1];
    loesung += m[2];
    last = m.index + m[0].length;
  }
  const rest = src.slice(last);
  if (rest) {
    segments.push({ kind: 'text', falsch: rest, richtig: rest });
    original += rest;
    loesung += rest;
  }
  return { original, loesung, segments, fehler };
}
