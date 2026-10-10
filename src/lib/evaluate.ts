// Auswertung aller Übungstypen. Reine Funktionen ohne Oberfläche.

import { charDiff, closest, lcsAlign, type DiffOp } from './diff';
import { ERR_SRC, parseFehler, type GapExpect, type MarkupError, type ParsedKomma } from './markup';
import { normalizeAnswer, tidyPunctuation } from './normalize';
import { canonicalVariants } from './varianten';
import type { Pruefung, Teilergebnis } from './types';

// ---------- Komma und Probe ----------

export type GapStatus = 'richtig' | 'fehlt' | 'ueberfluessig' | 'frei' | 'leer';

export interface KommaEval {
  richtig: boolean;
  gaps: { expect: GapExpect; set: boolean; status: GapStatus }[];
}

export function evalKomma(p: ParsedKomma, commas: boolean[]): KommaEval {
  const gaps = p.gaps.map((expect, i) => {
    const set = !!commas[i];
    let status: GapStatus;
    if (expect === 'frei') status = 'frei';
    else if (expect === 'ja') status = set ? 'richtig' : 'fehlt';
    else status = set ? 'ueberfluessig' : 'leer';
    return { expect, set, status };
  });
  return { richtig: gaps.every((g) => g.status !== 'fehlt' && g.status !== 'ueberfluessig'), gaps };
}

export type VerbStatus = 'richtig' | 'fehlt' | 'zuviel' | 'leer';

export interface VerbEval {
  richtig: boolean;
  marks: VerbStatus[];
}

export function evalVerben(p: ParsedKomma, marked: boolean[]): VerbEval {
  const marks = p.tokens.map((t, i): VerbStatus => {
    const m = !!marked[i];
    if (t.verb) return m ? 'richtig' : 'fehlt';
    return m ? 'zuviel' : 'leer';
  });
  return { richtig: marks.every((m) => m === 'richtig' || m === 'leer'), marks };
}

// ---------- Getippte Antworten ----------

export interface TypedEval {
  richtig: boolean;
  antwort: string;
  loesung: string;
  diff: DiffOp<string>[];
  /** Die Antwort entspricht einer gültigen Variante, nicht der Hauptlösung. */
  variante: boolean;
}

export function evalTyped(answer: string, loesungen: string[]): TypedEval {
  const a = normalizeAnswer(answer);
  const normed = loesungen.map((l) => normalizeAnswer(l));
  const canonA = canonicalVariants(a);
  let hit = normed.findIndex((l) => l === a);
  if (hit < 0) hit = normed.findIndex((l) => canonicalVariants(l) === canonA);
  if (hit >= 0) {
    const variante = hit > 0 || normed[hit] !== a || (loesungen.length > 1 && normed[0] !== a);
    return { richtig: true, antwort: answer, loesung: loesungen[hit], diff: [], variante };
  }
  const best = closest(a, normed);
  const idx = normed.indexOf(best);
  return { richtig: false, antwort: answer, loesung: loesungen[idx] ?? loesungen[0], diff: charDiff(a, best), variante: false };
}

/** Wortformen der Lösung, die in der Antwort fehlen (Rückmeldung bei „Umformen“). */
export function missingForms(answer: string, forms: string[]): string[] {
  const words = new Set(wordTokens(normalizeAnswer(answer)));
  return forms.filter((f) => f.split(/\s+/).some((w) => !words.has(w)));
}

// ---------- Fehler finden und Korrekturlesen ----------

const TOKEN_RE = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*'?|[^\s\p{L}\p{N}]/gu;

export function evalTokens(s: string): string[] {
  return canonicalVariants(normalizeAnswer(s)).match(TOKEN_RE) ?? [];
}

function wordTokens(s: string): string[] {
  return (s.match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) ?? []) as string[];
}

export type StellenErgebnis = 'gefunden' | 'uebersehen' | 'falsch';

export interface StelleEval {
  fehler: MarkupError;
  ergebnis: StellenErgebnis;
  /** Was an dieser Stelle in der Fassung des Nutzers steht. */
  nutzer: string;
}

export interface StellenEval {
  richtig: boolean;
  stellen: StelleEval[];
  falschGeaendert: { vorher: string; nachher: string }[];
  final: string;
  loesung: string;
}

interface Range {
  a: number;
  b: number;
}

function intact(r: Range, match: number[], lenX: number, lenF: number): boolean {
  if (r.a < r.b) {
    for (let i = r.a; i < r.b; i++) {
      if (match[i] < 0) return false;
      if (i > r.a && match[i] !== match[i - 1] + 1) return false;
    }
    return true;
  }
  const left = r.a > 0 ? match[r.a - 1] : -1;
  const right = r.a < lenX ? match[r.a] : lenF;
  if (r.a > 0 && left < 0) return false;
  if (r.a < lenX && right < 0) return false;
  return right === left + 1;
}

interface Hunk {
  sa: number;
  sb: number;
  fa: number;
  fb: number;
}

function hunks(match: number[], lenS: number, lenF: number): Hunk[] {
  const out: Hunk[] = [];
  let s = 0;
  let f = 0;
  while (s < lenS || f < lenF) {
    if (s < lenS && match[s] === f) {
      s++;
      f++;
      continue;
    }
    const sa = s;
    const fa = f;
    while (s < lenS && match[s] < 0) s++;
    const target = s < lenS ? match[s] : lenF;
    f = Math.max(f, target);
    out.push({ sa, sb: s, fa, fb: f });
  }
  return out;
}

function overlaps(h: Hunk, r: Range): boolean {
  const hEmpty = h.sa === h.sb;
  const rEmpty = r.a === r.b;
  if (!hEmpty && !rEmpty) return h.sa < r.b && r.a < h.sb;
  if (hEmpty && rEmpty) return h.sa === r.a;
  if (hEmpty) return r.a < h.sa && h.sa < r.b;
  return h.sa <= r.a && r.a <= h.sb;
}

function join(tokens: string[]): string {
  return tidyPunctuation(tokens.join(' '));
}

export interface PreparedFehler {
  original: string;
  loesung: string;
  fehler: MarkupError[];
  o: string[];
  s: string[];
  oRanges: Range[];
  sRanges: Range[];
}

export function prepareFehler(src: string): PreparedFehler {
  const p = parseFehler(src);
  const o = evalTokens(p.original);
  const s = evalTokens(p.loesung);
  const oRanges: Range[] = [];
  const sRanges: Range[] = [];
  let preO = '';
  let preS = '';
  for (const seg of p.segments) {
    if (seg.kind === 'fehler') {
      let oa = evalTokens(preO).length;
      let ob = evalTokens(preO + seg.falsch).length;
      let sa = evalTokens(preS).length;
      let sb = evalTokens(preS + seg.richtig).length;
      while (oa < ob && sa < sb && o[oa] === s[sa]) {
        oa++;
        sa++;
      }
      while (oa < ob && sa < sb && o[ob - 1] === s[sb - 1]) {
        ob--;
        sb--;
      }
      oRanges.push({ a: oa, b: ob });
      sRanges.push({ a: sa, b: sb });
    }
    preO += seg.falsch;
    preS += seg.richtig;
  }
  return { original: p.original, loesung: p.loesung, fehler: p.fehler, o, s, oRanges, sRanges };
}

/** Prüft die vom Nutzer bearbeitete Fassung gegen die Lösung. */
export function evalFehler(prep: PreparedFehler, final: string): StellenEval {
  const f = evalTokens(final);
  const matchSF = lcsAlign(prep.s, f);
  const stellen: StelleEval[] = prep.fehler.map((fehler, i) => {
    const sr = prep.sRanges[i];
    const or = prep.oRanges[i];
    // Nutzerfassung an der Stelle: alles zwischen den zugeordneten Nachbarn.
    let left = -1;
    for (let k = sr.a - 1; k >= 0; k--) {
      if (matchSF[k] >= 0) {
        left = matchSF[k];
        break;
      }
    }
    let right = f.length;
    for (let k = sr.b; k < prep.s.length; k++) {
      if (matchSF[k] >= 0) {
        right = matchSF[k];
        break;
      }
    }
    const nutzer = right > left ? join(f.slice(left + 1, right)) : '';
    let ergebnis: StellenErgebnis;
    if (intact(sr, matchSF, prep.s.length, f.length)) ergebnis = 'gefunden';
    else if (nutzer === join(prep.o.slice(or.a, or.b))) ergebnis = 'uebersehen';
    else ergebnis = 'falsch';
    return { fehler, ergebnis, nutzer };
  });
  const falschGeaendert = hunks(matchSF, prep.s.length, f.length)
    .filter((h) => !prep.sRanges.some((r) => overlaps(h, r)))
    .map((h) => ({ vorher: join(prep.s.slice(h.sa, h.sb)), nachher: join(f.slice(h.fa, h.fb)) }));
  return {
    richtig: stellen.every((s) => s.ergebnis === 'gefunden') && falschGeaendert.length === 0,
    stellen,
    falschGeaendert,
    final,
    loesung: prep.loesung,
  };
}

/** Freigestellte Stellen ([[x=>y|frei]]) zählen nie als Fehler: Beide Fassungen gelten. */
export const FREI = 'frei';

export interface PreparedTask {
  /** Je eine Fassung für jede Kombination freigestellter Stellen. */
  variants: PreparedFehler[];
  /** Grundfassung (alle freigestellten Stellen wie im Original). */
  base: PreparedFehler;
  /** Echte Fehler (ohne freigestellte Stellen). */
  fehler: MarkupError[];
  /** Freigestellte Stellen. */
  frei: MarkupError[];
}



export function prepareTask(src: string): PreparedTask {
  const all = [...src.matchAll(new RegExp(ERR_SRC, 'g'))];
  const n = Math.min(all.filter((m) => m[3]?.trim() === FREI).length, 4);
  const variants: PreparedFehler[] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    let k = 0;
    const text = src.replace(new RegExp(ERR_SRC, 'g'), (m: string, x: string, y: string, typ?: string) => {
      if (typ?.trim() !== FREI) return m;
      const bit = k < n ? (mask >> k) & 1 : 0;
      k++;
      return bit ? `[[${x}=>${y}|frei]]` : x;
    });
    variants.push(prepareFehler(text));
  }
  const base = variants[0];
  const full = parseFehler(src);
  return {
    variants,
    base,
    fehler: base.fehler,
    frei: full.fehler.filter((e) => e.fehlertyp === FREI),
  };
}

/** Wertet gegen alle Fassungen aus und wählt die günstigste für den Nutzer. */
export function evalTask(prep: PreparedTask, final: string): StellenEval {
  let best: StellenEval | null = null;
  let bestScore = Infinity;
  for (const v of prep.variants) {
    const ev = evalFehler(v, final);
    const real = ev.stellen.filter((s) => s.fehler.fehlertyp !== FREI);
    const freiFalsch = ev.stellen.filter((s) => s.fehler.fehlertyp === FREI && s.ergebnis === 'falsch').length;
    const score = real.filter((s) => s.ergebnis !== 'gefunden').length + ev.falschGeaendert.length + freiFalsch;
    if (score < bestScore) {
      bestScore = score;
      const extra = ev.stellen
        .filter((s) => s.fehler.fehlertyp === FREI && s.ergebnis === 'falsch')
        .map((s) => ({ vorher: s.fehler.falsch.trim(), nachher: s.nutzer }));
      best = { ...ev, stellen: real, falschGeaendert: [...ev.falschGeaendert, ...extra], richtig: score === 0, loesung: prep.base.loesung };
    }
  }
  return best!;
}

export function stellenTeile(ev: StellenEval, defaultTyp: string): Teilergebnis[] {
  const teile: Teilergebnis[] = ev.stellen.map((s) => ({
    fehlertyp: s.fehler.fehlertyp ?? defaultTyp,
    richtig: s.ergebnis === 'gefunden',
    label: `${s.fehler.falsch.trim()} → ${s.fehler.richtig.trim()}`,
  }));
  for (const fg of ev.falschGeaendert) {
    teile.push({ fehlertyp: '', richtig: false, label: `fälschlich geändert: ${fg.vorher || '∅'} → ${fg.nachher || '∅'}` });
  }
  return teile;
}

// ---------- Textwiedergabe (Lektion 3.7) ----------

function upperFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tokenEq(t: string, p: string): boolean {
  return t === p || t === upperFirst(p);
}

/** Sucht ein Muster mit Platzhalter „…“ (bis zu acht Wörter) in der Wortfolge. */
export function matchPattern(words: string[], pattern: string): boolean {
  const parts = pattern.split('…').map((x) => x.trim().split(/\s+/).filter(Boolean));
  const tryFrom = (pos: number, part: number): boolean => {
    if (part >= parts.length) return true;
    const seq = parts[part];
    const maxStart = part === 0 ? words.length - seq.length : Math.min(words.length - seq.length, pos + 8);
    for (let start = pos; start <= maxStart; start++) {
      if (seq.every((w, k) => tokenEq(words[start + k], w))) {
        if (tryFrom(start + seq.length, part + 1)) return true;
      }
    }
    return false;
  };
  return tryFrom(0, 0);
}

const EINLEITUNGEN: string[] = [
  'betont', 'betonen', 'behauptet', 'behaupten', 'erklärt', 'erklären', 'meint', 'meinen', 'schreibt', 'schreiben',
  'stellt … fest', 'stellen … fest', 'hebt … hervor', 'heben … hervor', 'führt … aus', 'führen … aus', 'argumentiert',
  'argumentieren', 'kritisiert', 'kritisieren', 'fordert', 'fordern', 'warnt', 'warnen', 'gibt … zu bedenken',
  'räumt … ein', 'räumen … ein', 'vertritt', 'vertreten', 'ist der Ansicht', 'ist der Auffassung', 'ist der Meinung',
  'sind der Ansicht', 'sind der Auffassung', 'legt … dar', 'verweist', 'unterstreicht', 'ergänzt', 'folgert',
  'bemängelt', 'beklagt', 'bezweifelt', 'weist … hin', 'macht … deutlich', 'verdeutlicht', 'konstatiert', 'resümiert',
  'fügt … hinzu', 'fährt … fort', 'kommt zu dem Schluss', 'geht davon aus', 'hält … fest', 'führt … an', 'merkt … an',
  'gibt … an', 'erläutert', 'begründet', 'vermutet', 'bestreitet', 'verlangt', 'äußert', 'sagt', 'zeigt … auf',
  'stellt … dar', 'beschreibt', 'beobachtet', 'befürchtet', 'mahnt', 'appelliert', 'plädiert', 'empfiehlt', 'rät',
  'gesteht … zu', 'wendet … ein', 'hält … für', 'sieht', 'glaubt', 'zweifelt', 'urteilt', 'bilanziert', 'schließt',
  'erinnert … daran', 'macht … geltend',
];

const PRAETERITUM_EINLEITUNGEN = [
  'betonte', 'behauptete', 'erklärte', 'meinte', 'schrieb', 'stellte', 'hob', 'führte', 'argumentierte',
  'kritisierte', 'forderte', 'warnte', 'räumte', 'vertrat', 'legte', 'verwies', 'unterstrich', 'ergänzte', 'folgerte',
  'sagte', 'beschrieb', 'erläuterte', 'begründete', 'vermutete', 'bestritt', 'verlangte', 'äußerte', 'betonten',
  'behaupteten', 'erklärten', 'meinten', 'schrieben',
];

/** Zählt, wie oft ein Muster vorkommt (verschiedene Anfangspositionen). */
export function countPattern(words: string[], pattern: string): number {
  const parts = pattern.split('…').map((x) => x.trim().split(/\s+/).filter(Boolean));
  const rest = (pos: number, part: number): boolean => {
    if (part >= parts.length) return true;
    const seq = parts[part];
    const maxStart = Math.min(words.length - seq.length, pos + 8);
    for (let start = pos; start <= maxStart; start++) {
      if (seq.every((w, k) => tokenEq(words[start + k], w)) && rest(start + seq.length, part + 1)) return true;
    }
    return false;
  };
  let n = 0;
  const first = parts[0];
  for (let s = 0; s + first.length <= words.length; s++) {
    if (first.every((w, k) => tokenEq(words[s + k], w)) && rest(s + first.length, 1)) n++;
  }
  return n;
}

export interface PruefEval {
  richtig: boolean;
  checks: { label: string; ok: boolean; fehlertyp: string; detail?: string }[];
  einleitungen: string[];
  hinweise: string[];
}

export function evalTextwiedergabe(answer: string, pruefungen: Pruefung[], saetze: number): PruefEval {
  const words = wordTokens(canonicalVariants(normalizeAnswer(answer)));
  // Gleiche Erwartungen mehrfach: Jede Prüfstelle braucht ihr eigenes Vorkommen.
  const used = new Map<string, number>();
  const checks = pruefungen.map((p) => {
    const key = p.erwartet.join('|');
    const k = used.get(key) ?? 0;
    used.set(key, k + 1);
    const total = p.erwartet.reduce((sum, e) => sum + countPattern(words, e), 0);
    const hit = total > k;
    const bad = (p.vermeiden ?? []).filter((v) => matchPattern(words, v));
    const ok = hit && bad.length === 0;
    let detail: string | undefined;
    if (!hit) detail = `erwartet: ${p.erwartet.map((e) => `„${e}“`).join(' oder ')}`;
    else if (bad.length) detail = `nicht verwenden: ${bad.map((b) => `„${b}“`).join(', ')}`;
    return { label: p.label, ok, fehlertyp: p.fehlertyp, detail };
  });
  const einleitungen = EINLEITUNGEN.filter((e) => matchPattern(words, e));
  const praet = PRAETERITUM_EINLEITUNGEN.filter((e) => words.includes(e));
  checks.push({
    label: 'Redeeinleitungen im Präsens',
    ok: praet.length === 0,
    fehlertyp: 'w-tempus',
    detail: praet.length ? `im Präteritum: ${praet.map((p) => `„${p}“`).join(', ')}` : undefined,
  });
  const hinweise: string[] = [];
  const noetig = saetze >= 3 ? 2 : 1;
  if (einleitungen.length < noetig) {
    hinweise.push(
      einleitungen.length === 0
        ? 'Keine Redeeinleitung erkannt. Nenne die Quelle mit einem Verb des Sagens, etwa „betont“ oder „hebt hervor“.'
        : 'Wechsle die Redeeinleitungen, etwa „betont“, „hebt hervor“, „räumt ein“.',
    );
  }
  return { richtig: checks.every((c) => c.ok), checks, einleitungen, hinweise };
}

export function pruefTeile(ev: PruefEval): Teilergebnis[] {
  return ev.checks.map((c) => ({ fehlertyp: c.fehlertyp, richtig: c.ok, label: c.label }));
}
