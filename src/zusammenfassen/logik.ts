// Lernlogik des Moduls „Zusammenfassen“: Stufe, Ampel, Gewichtung und Zusammenstellung der Übungen.

import { addDays, diffDays, weekKey } from '../lib/dates';
import { rng, shuffle } from '../lib/random';
import { ARTEN, FUNKTIONEN, KATEGORIEN, nachname, saetze, TEXTE, text as textVon, woerter } from './daten';
import type { Funktion, ZArt, ZItem, ZKat, ZState, ZText } from './typen';

// ---------- Stufe ----------

export function abgeschlosseneVolltexte(s: ZState): number {
  return s.volltexte.filter((v) => v.phase === 'fertig' && !v.eigen).length;
}

/** Stufe nach Fortschritt: kurze, klar gegliederte Texte zuerst, später längere mit versteckter These. */
export function niveauAuto(s: ZState): 1 | 2 | 3 {
  const fertig = abgeschlosseneVolltexte(s);
  const letzte = s.uebungen.slice(-80);
  const q = letzte.length ? letzte.filter((u) => u.richtig).length / letzte.length : 0;
  if (fertig >= 10 || (s.uebungen.length >= 150 && q >= 0.85)) return 3;
  if (fertig >= 4 || (s.uebungen.length >= 50 && q >= 0.8)) return 2;
  return 1;
}

export function niveau(s: ZState): 1 | 2 | 3 {
  return s.niveau ?? niveauAuto(s);
}

export const NIVEAU_TEXT: Record<1 | 2 | 3, string> = {
  1: 'Stufe 1: kurze Texte, klare Gliederung, These früh',
  2: 'Stufe 2: mittellange Texte',
  3: 'Stufe 3: längere Texte, versteckte These',
};

// ---------- Ampel und Fehler ----------

export type ZAmpel = 'offen' | 'rot' | 'gelb' | 'gruen';

export function katStatistik(s: ZState, kat: ZKat, n = 20): { ok: number; gesamt: number; quote: number } {
  const ev = s.ereignisse.filter((e) => e.kat === kat).slice(-n);
  const ok = ev.filter((e) => e.ok).length;
  return { ok, gesamt: ev.length, quote: ev.length ? ok / ev.length : 0 };
}

export function ampel(s: ZState, kat: ZKat): ZAmpel {
  const st = katStatistik(s, kat);
  if (st.gesamt < 3) return 'offen';
  if (st.quote >= 0.9 && st.gesamt >= 5) return 'gruen';
  if (st.quote >= 0.7) return 'gelb';
  return 'rot';
}

export function fehlerJeKat(s: ZState, today: string, tage = 14): Map<ZKat, number> {
  const m = new Map<ZKat, number>();
  for (const e of s.ereignisse) if (!e.ok && diffDays(today, e.tag) < tage) m.set(e.kat, (m.get(e.kat) ?? 0) + 1);
  return m;
}

export function haeufigsteFehler(s: ZState, today: string, n = 3): { kat: ZKat; anzahl: number }[] {
  return [...fehlerJeKat(s, today, 30).entries()]
    .map(([kat, anzahl]) => ({ kat, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl)
    .slice(0, n);
}

/** Anteil richtiger Antworten je Woche (Teilübungen und Checklisten). */
export function wochenVerlauf(s: ZState, today: string, wochen = 10): { woche: string; gesamt: number; ok: number }[] {
  const start = weekKey(addDays(today, -7 * (wochen - 1)));
  const out = Array.from({ length: wochen }, (_, i) => ({ woche: addDays(start, 7 * i), gesamt: 0, ok: 0 }));
  for (const e of s.ereignisse) {
    const w = out.find((x) => x.woche === weekKey(e.tag));
    if (!w) continue;
    w.gesamt++;
    if (e.ok) w.ok++;
  }
  return out;
}

/** Gewicht einer Übungsart: Arten zu häufigen Fehlerkategorien erscheinen öfter. */
export function gewicht(s: ZState, a: ZArt, today: string, fehler = fehlerJeKat(s, today)): number {
  const def = ARTEN.find((x) => x.id === a)!;
  let w = 1;
  for (const k of def.kats) {
    w += 1.5 * (fehler.get(k) ?? 0);
    if (ampel(s, k) === 'rot') w += 2;
  }
  return w;
}

// ---------- Teilaufgaben je Text ----------

export function anzahlTeilaufgaben(t: ZText, a: ZArt): number {
  switch (a) {
    case 'kernBeispiel':
      return t.kernBeispiel.length;
    case 'funktionsverb':
      return t.abschnitte.length;
    case 'verdichten':
      return verdichtbar(t).length;
    case 'fingertest':
      return t.fingertest.length;
    case 'synonym':
      return t.synonyme.length;
    case 'konjunktiv':
      return t.konjunktiv.length;
    case 'einleitungPruefen':
      return DEFEKTE.length;
    default:
      return 1;
  }
}

function zuletzt(s: ZState): Map<string, number> {
  const m = new Map<string, number>();
  for (const u of s.uebungen) m.set(`${u.art}|${u.textId}|${u.n ?? 0}`, u.zeit);
  for (const u of s.uebungen) m.set(u.textId, Math.max(m.get(u.textId) ?? 0, u.zeit));
  return m;
}

/** Texte, aus denen Übungen gezogen werden: bis zur aktuellen Stufe, die aktuelle Stufe bevorzugt. */
export function textPool(s: ZState): ZText[] {
  const nv = niveau(s);
  return TEXTE.filter((t) => t.stufe <= nv);
}

/** Stellt eine Sitzung zusammen: Übungsarten und Texte wechseln sich ab (interleaving). */
export function sitzungItems(s: ZState, arten: ZArt[], n: number, today: string, seed: string): ZItem[] {
  const rand = rng(seed);
  const nv = niveau(s);
  const pool = textPool(s);
  const recent = zuletzt(s);
  const fehler = fehlerJeKat(s, today);
  const out: ZItem[] = [];
  const benutzt = new Set<string>();
  for (let k = 0; k < n; k++) {
    // Art nach Gewicht, nicht zweimal hintereinander
    const kand = arten.filter((a) => arten.length === 1 || a !== out[k - 1]?.art);
    const ws = kand.map((a) => gewicht(s, a, today, fehler));
    let r = rand() * ws.reduce((x, y) => x + y, 0);
    const a = kand.find((_, i) => (r -= ws[i]) <= 0) ?? kand[kand.length - 1];
    // Text: anderer als zuvor, aktuelle Stufe bevorzugt, lange nicht gesehen
    const texte = pool
      .filter((t) => t.id !== out[k - 1]?.textId && anzahlTeilaufgaben(t, a) > 0)
      .map((t) => ({ t, p: (t.stufe === nv ? 0 : 1) + (recent.get(t.id) ?? 0) / 1e13 + rand() * 0.9 }))
      .sort((x, y) => x.p - y.p);
    let gewaehlt: ZItem | null = null;
    for (const { t } of texte) {
      const m = anzahlTeilaufgaben(t, a);
      const opts = Array.from({ length: m }, (_, i) => i)
        .filter((i) => !benutzt.has(`${a}|${t.id}|${i}`))
        .sort((x, y) => (recent.get(`${a}|${t.id}|${x}`) ?? 0) - (recent.get(`${a}|${t.id}|${y}`) ?? 0) || rand() - 0.5);
      if (opts.length) {
        gewaehlt = { art: a, textId: t.id, n: opts[0] };
        break;
      }
    }
    if (!gewaehlt) continue;
    benutzt.add(`${gewaehlt.art}|${gewaehlt.textId}|${gewaehlt.n}`);
    out.push(gewaehlt);
  }
  return out;
}

/** Nächster Text für eine ganze Zusammenfassung: noch nicht bearbeitet, aktuelle Stufe zuerst. */
export function naechsterVolltext(s: ZState): ZText {
  const nv = niveau(s);
  const fertig = new Map<string, number>();
  for (const v of s.volltexte) if (!v.eigen) fertig.set(v.textId, Math.max(fertig.get(v.textId) ?? 0, v.start));
  const kand = TEXTE.filter((t) => t.stufe <= nv)
    .map((t) => ({ t, p: (fertig.has(t.id) ? 10 + (fertig.get(t.id)! / 1e13) : 0) + (t.stufe === nv ? 0 : 1) }))
    .sort((a, b) => a.p - b.p || a.t.id.localeCompare(b.t.id));
  return kand[0]?.t ?? TEXTE[0];
}

/** Abschnitte, deren Musterlösung ein Satz mit höchstens 30 Wörtern ist (Vergleich beim Verdichten). */
export function verdichtbar(t: ZText): number[] {
  return t.abschnitte.map((a, i) => ({ a, i })).filter(({ a }) => woerter(a.muster) <= 30 && saetze(a.muster) === 1).map(({ i }) => i);
}

/** Schlusssätze zur Auswahl, in fester Reihenfolge je Text. */
export function schlussOptionen(t: ZText): { satz: string; art: 'richtig' | 'teilaspekt' | 'dazugedichtet' | 'wertung'; grund: string }[] {
  return shuffle([{ satz: t.schluss, art: 'richtig' as const, grund: '' }, ...t.schlussFalsch], rng(`${t.id}:schluss`));
}

// ---------- Struktur: Funktionen zur Auswahl ----------

export function funktionsOptionen(t: ZText, abschnitt: number): Funktion[] {
  const a = t.abschnitte[abschnitt];
  const rand = rng(`${t.id}:f:${abschnitt}`);
  const erlaubt = new Set([a.funktion, ...(a.auch ?? [])]);
  const andere = shuffle(
    FUNKTIONEN.map((f) => f.id).filter((f) => !erlaubt.has(f)),
    rand,
  ).slice(0, 3);
  return shuffle([a.funktion, ...andere], rand);
}

export function verbOptionen(t: ZText, abschnitt: number): string[] {
  const a = t.abschnitte[abschnitt];
  return shuffle([a.verb, ...a.verbFalsch.map((v) => v.verb)], rng(`${t.id}:v:${abschnitt}`));
}

// ---------- Einleitung prüfen: Varianten mit genau einem Mangel ----------

export const DEFEKTE = ['autor', 'titel', 'textsorte', 'erschienen', 'wertung', 'zeilen', 'praeteritum', 'ok'] as const;
export type Defekt = (typeof DEFEKTE)[number];

export const DEFEKT_LABEL: Record<Defekt, string> = {
  autor: 'Der Name des Verfassers fehlt.',
  titel: 'Der Titel fehlt.',
  textsorte: 'Die Textsorte stimmt nicht.',
  erschienen: 'Erscheinungsort und -datum fehlen.',
  wertung: 'Sie enthält eine eigene Wertung.',
  zeilen: 'Sie enthält eine Zeilenangabe.',
  praeteritum: 'Sie steht im Präteritum.',
  ok: 'Nichts, sie ist vollständig und richtig.',
};

export const DEFEKT_GRUND: Record<Defekt, string> = {
  autor: 'Die Einleitung nennt immer den vollen Namen des Verfassers.',
  titel: 'Der Titel gehört in Anführungszeichen in die Einleitung.',
  textsorte: 'Die Textsorte muss stimmen; sie sagt, wie der Text zu lesen ist.',
  erschienen: 'Medium und Datum stehen in der Quellenzeile und gehören in die Einleitung.',
  wertung: 'Die Einleitung informiert sachlich; Wertungen gehören höchstens in ein kurzes Fazit.',
  zeilen: 'Die Lehrerin erwartet eine Wiedergabe ohne Zeilenangaben.',
  praeteritum: 'Die Textwiedergabe steht im Präsens.',
  ok: 'Alle Angaben sind da: Textsorte, Titel, Verfasser, Erscheinungsort und -datum, Thema und Kernaussage.',
};

const FALSCHE_SORTE: Record<string, string> = { Kommentar: 'Bericht', Bericht: 'Kommentar', Essay: 'Bericht', Sachbuchauszug: 'Kommentar' };

function artikel(sorte: string, adj = ''): string {
  const a = adj ? `${adj} ` : '';
  if (sorte === 'Sachbuchauszug') return `dem Auszug aus dem ${a}Sachbuch`;
  return `dem ${a}${sorte}`;
}

export function einleitungVariante(t: ZText, d: Defekt): string {
  const sorte = d === 'textsorte' ? FALSCHE_SORTE[t.textsorte] : t.textsorte;
  const adj = d === 'wertung' ? 'überzeugenden' : '';
  const titel = d === 'titel' ? '' : ` „${t.titel}“`;
  const von = d === 'autor' ? '' : ` von ${t.autor}`;
  const ersch = d === 'erschienen' ? '' : `, ${t.erschienen},`;
  const geht = d === 'praeteritum' ? 'ging es um' : 'geht es um';
  const s1 = `In ${artikel(sorte, adj)}${titel}${von}${ersch} ${geht} ${t.thema}.`.replace(/\s+,/g, ',');
  const bericht = t.textsorte === 'Bericht';
  let subj = nachname(t.autor);
  let verb = bericht ? (d === 'praeteritum' ? 'kam zu dem Ergebnis' : 'kommt zu dem Ergebnis') : d === 'praeteritum' ? 'vertrat die These' : 'vertritt die These';
  if (d === 'autor') {
    subj = bericht ? 'Das Ergebnis lautet' : 'Vertreten wird die These';
    verb = '';
  }
  const zeilen = d === 'zeilen' ? ' (Z. 4–7)' : '';
  const s2 = `${subj}${verb ? ` ${verb}` : ''}, dass ${t.kernaussage}${zeilen}.`;
  return `${s1} ${s2}`;
}

export function defektOptionen(t: ZText, d: Defekt): Defekt[] {
  const rand = rng(`${t.id}:d:${d}`);
  const andere = shuffle(
    DEFEKTE.filter((x) => x !== d),
    rand,
  ).slice(0, 3);
  return shuffle([d, ...andere], rand);
}

// ---------- Kategorien ----------

export function alleKategorien(): ZKat[] {
  return KATEGORIEN.map((k) => k.id);
}

export function textTitel(id: string): string {
  return textVon(id)?.titel ?? id;
}
