// Fehlerbuch: Status je Eintrag, Fehlerprofil, Typvorschlag beim Erfassen.

import { diffDays } from './dates';
import { lcsAlign } from './diff';
import { FEHLERTYPEN, fehlertyp } from './fehlertypen';
import { units, type Unit } from './mastery';
import { normalizeAnswer } from './normalize';
import type { Attempt, ErrorEntry } from './types';

export type EntryStatus = 'offen' | 'inUebung' | 'behoben';

export const STATUS_LABEL: Record<EntryStatus, string> = {
  offen: 'offen',
  inUebung: 'in Übung',
  behoben: 'behoben',
};

interface TypeEvent {
  zeit: number;
  tag: string;
  kind: 'richtig' | 'falsch' | 'eintrag';
}

/** Ereignisse je Fehlertyp, zeitlich sortiert. */
export function typeEvents(attempts: Attempt[], errors: ErrorEntry[]): Map<string, TypeEvent[]> {
  const map = new Map<string, TypeEvent[]>();
  const push = (t: string, e: TypeEvent) => {
    if (!t) return;
    if (!map.has(t)) map.set(t, []);
    map.get(t)!.push(e);
  };
  for (const a of attempts) {
    for (const u of units(a)) push(u.fehlertyp, { zeit: u.zeit, tag: u.tag, kind: u.richtig ? 'richtig' : 'falsch' });
  }
  for (const e of errors) {
    if (e.herkunft === 'arbeit') push(e.fehlertyp, { zeit: e.zeit, tag: e.tag, kind: 'eintrag' });
  }
  for (const list of map.values()) list.sort((a, b) => a.zeit - b.zeit);
  return map;
}

export interface StatusInfo {
  status: EntryStatus;
  wiedereroeffnet: boolean;
  serie: number;
  tage: number;
}

/**
 * Behoben ist ein Eintrag, wenn sein Fehlertyp fünfmal in Folge an mindestens drei verschiedenen Tagen
 * richtig beantwortet wurde. Tritt der Typ erneut auf, öffnet sich der Eintrag wieder.
 */
export function entryStatus(entry: ErrorEntry, events: Map<string, TypeEvent[]>): StatusInfo {
  const list = events.get(entry.fehlertyp) ?? [];
  let status: EntryStatus = 'offen';
  let wiedereroeffnet = false;
  let run = 0;
  let days = new Set<string>();
  for (const ev of list) {
    if (ev.zeit <= entry.zeit) continue;
    if (ev.kind === 'richtig') {
      if (status === 'behoben') continue;
      run++;
      days.add(ev.tag);
      status = run >= 5 && days.size >= 3 ? 'behoben' : 'inUebung';
    } else {
      run = 0;
      days = new Set();
      if (status === 'behoben') {
        status = 'offen';
        wiedereroeffnet = true;
      } else if (ev.kind === 'falsch') {
        status = 'inUebung';
      }
    }
  }
  return { status, wiedereroeffnet, serie: run, tage: days.size };
}

export function allStatuses(attempts: Attempt[], errors: ErrorEntry[]): Map<string, StatusInfo> {
  const ev = typeEvents(attempts, errors);
  const out = new Map<string, StatusInfo>();
  for (const e of errors) out.set(e.id, entryStatus(e, ev));
  return out;
}

// ---------- Fehlerprofil ----------

export interface TypeScore {
  typ: string;
  aufgaben: number;
  falsch: number;
  arbeit: number;
  quote: number;
  score: number;
}

export function typeScores(attempts: Attempt[], errors: ErrorEntry[], today: string, tage = 30): TypeScore[] {
  const stats = new Map<string, TypeScore>();
  const get = (t: string) => {
    if (!stats.has(t)) stats.set(t, { typ: t, aufgaben: 0, falsch: 0, arbeit: 0, quote: 1, score: 0 });
    return stats.get(t)!;
  };
  for (const a of attempts) {
    if (diffDays(today, a.tag) >= tage) continue;
    for (const u of units(a)) {
      if (!u.fehlertyp) continue;
      const s = get(u.fehlertyp);
      s.aufgaben++;
      if (!u.richtig) s.falsch++;
    }
  }
  for (const e of errors) {
    if (e.herkunft !== 'arbeit' || diffDays(today, e.tag) >= tage) continue;
    get(e.fehlertyp).arbeit++;
  }
  for (const s of stats.values()) {
    s.quote = s.aufgaben ? (s.aufgaben - s.falsch) / s.aufgaben : 1;
    // Geglättete Fehlerquote; Fehler aus echten Arbeiten zählen doppelt.
    s.score = (s.falsch + 2 * s.arbeit) / (s.aufgaben + 2 * s.arbeit + 3);
  }
  return [...stats.values()].filter((s) => fehlertyp(s.typ)).sort((a, b) => b.score - a.score);
}

/** Die schwächsten Fehlertypen: nur Typen mit Fehlern, deren Einträge nicht alle behoben sind. */
export function weakestTypes(attempts: Attempt[], errors: ErrorEntry[], today: string, n = 3, statuses?: Map<string, StatusInfo>): TypeScore[] {
  const st = statuses ?? allStatuses(attempts, errors);
  const open = new Set(errors.filter((e) => st.get(e.id)?.status !== 'behoben').map((e) => e.fehlertyp));
  return typeScores(attempts, errors, today)
    .filter((s) => (s.falsch > 0 || s.arbeit > 0) && open.has(s.typ))
    .slice(0, n);
}

/** Die häufigsten Fehlertypen eines Zeitraums nach Anzahl. */
export function frequentTypes(attempts: Attempt[], errors: ErrorEntry[], today: string, tage = 30, n = 5) {
  const counts = new Map<string, number>();
  for (const a of attempts) {
    if (diffDays(today, a.tag) >= tage) continue;
    for (const u of units(a)) if (!u.richtig && u.fehlertyp) counts.set(u.fehlertyp, (counts.get(u.fehlertyp) ?? 0) + 1);
  }
  for (const e of errors) {
    if (e.herkunft === 'arbeit' && diffDays(today, e.tag) < tage) counts.set(e.fehlertyp, (counts.get(e.fehlertyp) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([t]) => fehlertyp(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([typ, anzahl]) => ({ typ, anzahl }));
}

// ---------- Arbeiten im Vergleich ----------

export interface Arbeit {
  quelle: string;
  ersterTag: string;
  anzahl: number;
  typen: Map<string, number>;
}

export function arbeiten(errors: ErrorEntry[]): Arbeit[] {
  const map = new Map<string, Arbeit>();
  for (const e of errors) {
    if (e.herkunft !== 'arbeit') continue;
    const key = e.quelle.trim() || 'Ohne Quelle';
    if (!map.has(key)) map.set(key, { quelle: key, ersterTag: e.tag, anzahl: 0, typen: new Map() });
    const a = map.get(key)!;
    a.anzahl++;
    if (e.tag < a.ersterTag) a.ersterTag = e.tag;
    a.typen.set(e.fehlertyp, (a.typen.get(e.fehlertyp) ?? 0) + 1);
  }
  return [...map.values()].sort((a, b) => (a.ersterTag < b.ersterTag ? -1 : a.ersterTag > b.ersterTag ? 1 : a.quelle.localeCompare(b.quelle)));
}

export function knownSources(errors: ErrorEntry[]): string[] {
  const seen = new Map<string, number>();
  for (const e of errors) {
    if (e.herkunft !== 'arbeit' || !e.quelle.trim()) continue;
    seen.set(e.quelle.trim(), Math.max(seen.get(e.quelle.trim()) ?? 0, e.zeit));
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([q]) => q);
}

// ---------- Typvorschlag ----------

const TOKEN_RE = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*'?|[^\s\p{L}\p{N}]/gu;

function toks(s: string): string[] {
  return normalizeAnswer(s).match(TOKEN_RE) ?? [];
}

const EINLEITEWOERTER = new Set([
  'dass', 'weil', 'ob', 'wenn', 'als', 'obwohl', 'obgleich', 'da', 'damit', 'nachdem', 'bevor', 'ehe', 'während', 'sodass',
  'indem', 'falls', 'sobald', 'solange', 'seit', 'seitdem', 'bis', 'wie', 'wo', 'wohin', 'woher', 'warum', 'weshalb',
  'was', 'wer', 'wen', 'wem', 'wessen', 'welche', 'welcher', 'welches', 'welchem', 'welchen', 'der', 'die', 'das', 'dem',
  'den', 'dessen', 'deren', 'denen', 'je', 'ohne', 'anstatt', 'statt', 'worauf', 'womit', 'wodurch', 'wofür', 'wovon',
]);
const REIHE = new Set(['aber', 'sondern', 'doch', 'jedoch', 'denn', 'andererseits']);
const ARTIKEL = new Set(['der', 'die', 'das', 'des', 'dem', 'den', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen', 'kein', 'keine', 'keiner', 'keines', 'keinem', 'keinen', 'sein', 'seine', 'seiner', 'seines', 'seinem', 'seinen', 'ihr', 'ihre', 'ihrer', 'ihres', 'ihrem', 'ihren', 'dieser', 'diese', 'dieses', 'diesem', 'diesen']);
const PAARE: [string, string][] = [
  ['seid', 'seit'], ['wider', 'wieder'], ['wahr', 'war'], ['den', 'denn'], ['wen', 'wenn'], ['man', 'Mann'], ['ist', 'isst'],
  ['fiel', 'viel'], ['Stadt', 'statt'], ['Paar', 'paar'], ['Mal', 'mal'], ['scheinbar', 'anscheinend'], ['Worte', 'Wörter'],
  ['als', 'wie'], ['dasselbe', 'das gleiche'], ['zurzeit', 'zur Zeit'], ['Wiedergabe', 'Widergabe'], ['wiederspiegeln', 'widerspiegeln'],
  ['erwiedern', 'erwidern'], ['Wiederspruch', 'Widerspruch'], ['wiedersprechen', 'widersprechen'],
];

function isPunct(t: string) {
  return !/[\p{L}\p{N}]/u.test(t);
}

/** Schlägt anhand der Abweichung zwischen falscher und richtiger Fassung einen Fehlertyp vor. */
/** Wörter und Zeichen, die im Aufsatz als umgangssprachlich gelten (Lektion 9.6). */
const UMGANGSSPRACHE = new Set(['erstmal', 'schlussendlich', 'kriegt', 'kriegen', 'kriegte', 'gekriegt', 'guckt', 'gucken', 'guckte', 'checkt', 'checken', 'gecheckt', 'krass', 'total', 'halt', 'irgendwie', 'rein', 'raus', 'via', 'bspw.', 'brd', 'tut', 'tun', 'tat', '%', '€', 'okay', 'ok']);

export function suggestType(original: string, korrektur: string): string | undefined {
  const a = toks(original);
  const b = toks(korrektur);
  if (!a.length || !b.length || a.join(' ') === b.join(' ')) return undefined;
  const match = lcsAlign(a, b);
  const removed: { i: number; t: string }[] = [];
  a.forEach((t, i) => {
    if (match[i] < 0) removed.push({ i, t });
  });
  const used = new Set(match.filter((m) => m >= 0));
  const added: { j: number; t: string }[] = [];
  b.forEach((t, j) => {
    if (!used.has(j)) added.push({ j, t });
  });
  const rem = removed.map((r) => r.t);
  const add = added.map((r) => r.t);
  const remJoined = rem.join('');
  const addJoined = add.join('');

  // Nur Satzzeichen verändert
  if (rem.every(isPunct) && add.every(isPunct)) {
    const all = [...rem, ...add];
    if (all.some((t) => t === '"')) return /\((?:Z|V|S)\./.test(korrektur) ? 'z-zitat' : 'z-rede';
    if (all.some((t) => t === ':' || t === ';')) return 'z-doppelpunkt';
    if (all.some((t) => t === "'")) return 'z-apostroph';
    if (all.some((t) => t === '-')) return 'z-bindestrich';
    if (add.includes(',') && !rem.includes(',')) {
      const commas = added.filter((x) => x.t === ',');
      if (commas.length >= 2) return 'k-einschub';
      const next = b[commas[0].j + 1] ?? '';
      const lower = next.toLowerCase();
      if (REIHE.has(lower)) return 'k-reihe';
      const window = b.slice(commas[0].j + 1, commas[0].j + 10);
      if (['um', 'ohne', 'statt', 'anstatt'].includes(lower) || (window.includes('zu') && !EINLEITEWOERTER.has(lower))) return 'k-infinitiv';
      if (EINLEITEWOERTER.has(lower)) return 'k-nebensatz';
      if (lower === 'und' || lower === 'oder') return 'k-nebensatz';
      return 'k-aufzaehlung';
    }
    if (rem.includes(',') && !add.includes(',')) return 'k-ueberfluessig';
    return undefined;
  }

  const wrd = (s: string) => s.replace(/[^\p{L}\p{N}' ]/gu, '');
  const remText = removed.filter((x) => !isPunct(x.t)).map((x) => x.t).join(' ');
  const addText = added.filter((x) => !isPunct(x.t)).map((x) => x.t).join(' ');

  for (const [x, y] of PAARE) {
    if ((remText === x && addText === y) || (remText === y && addText === x)) return 'w-verwechslung';
  }
  if (removed.some((x) => UMGANGSSPRACHE.has(x.t.toLowerCase()))) return 'w-umgangssprache';
  if ((remText === 'das' && addText === 'dass') || (remText === 'dass' && addText === 'das')) return 'r-dasdass';
  if ((remText === 'das' && addText === 'was') || (remText === 'was' && addText === 'das') || /^(dessen|deren|denen)$/.test(addText)) return 'w-relativ';
  if (remText && remText.toLowerCase() === addText.toLowerCase()) return 'r-gross';
  if (wrd(remJoined).replace(/\s|-/g, '') === wrd(addJoined).replace(/\s|-/g, '') && remText !== addText) {
    return remJoined.includes('-') || addJoined.includes('-') ? 'z-bindestrich' : 'r-getrennt';
  }
  if (remText.replace(/ß|ss|s/g, 'S') === addText.replace(/ß|ss|s/g, 'S')) return 'r-s';

  const one = rem.filter((t) => !isPunct(t));
  const two = add.filter((t) => !isPunct(t));
  if (one.length === 1 && two.length === 1) {
    const x = one[0];
    const y = two[0];
    if (ARTIKEL.has(x.toLowerCase()) && ARTIKEL.has(y.toLowerCase())) return 'f-praeposition';
    if (/^\p{Lu}/u.test(x) && (y === `${x}en` || y === `${x}n` || x === `${y}en` || x === `${y}n`)) return 'f-ndeklination';
    if (/^ge/.test(x) && x.slice(2) === y && /(t|en)$/.test(y)) return 'w-partizip';
    if (x === 'ist' && y === 'sei') return 'kj-indikativ';
    if (/^(würde|würden|würdest|würdet)$/.test(y)) return 'kj-ausweich';
    if (x.length > 3 && y.length > 3 && x.slice(0, -2) === y.slice(0, -2) && /(e|en|er|es|em)$/.test(x) && /(e|en|er|es|em)$/.test(y) && /^\p{Ll}/u.test(x)) {
      if (/t$/.test(x) || /t$/.test(y)) return 'kj-indikativ';
      return 'f-adjektiv';
    }
    if (/t$/.test(x) && y === `${x.slice(0, -1)}e`) return 'kj-indikativ';
    if (/^(hat|haben|wird|werden|kann|muss|soll|will|darf|mag)$/.test(x) && /^(habe|hätten|werde|würden|könne|müsse|solle|wolle|dürfe|möge)$/.test(y)) return 'kj-indikativ';
    const dedupe = (s: string) => s.replace(/(.)\1/g, '$1').replace(/ie/g, 'i').replace(/h/g, '').replace(/ck/g, 'k').replace(/tz/g, 'z');
    if (dedupe(x.toLowerCase()) === dedupe(y.toLowerCase())) return 'r-dehnung';
    const stamm = (s: string) => s.replace(/äu/g, 'eu').replace(/ä/g, 'e').replace(/[dt]/g, 'T').replace(/[bp]/g, 'P').replace(/[gk]/g, 'K');
    if (stamm(x.toLowerCase()) === stamm(y.toLowerCase())) return 'r-stamm';
    if (/^\p{Lu}/u.test(y) && x.length > 4 && editRatio(x, y) < 0.35) return 'r-fremdwort';
  }
  return undefined;
}

function editRatio(a: string, b: string): number {
  const m = lcsAlign(Array.from(a), Array.from(b)).filter((x) => x >= 0).length;
  return 1 - m / Math.max(a.length, b.length);
}

export const FEHLERTYP_IDS = FEHLERTYPEN.map((t) => t.id);

export type { Unit };
