// Lernlogik des Moduls „Meine Schwächen“ (ohne Oberfläche, ohne Speicher).
//
// Stufen je Kategorie:
//   0  neu oder zurückgefallen (Ampel rot)
//   1  Einzeltraining mit mindestens 90 % bestanden, Prüfung nach 1 Tag fällig (gelb)
//   2  erste Prüfung bestanden, nächste nach 3 Tagen (gelb)
//   3  zweite Prüfung bestanden, nächste nach 7 Tagen (gelb)
//   4  dritte Prüfung bestanden: gemeistert (grün)
// Eine Prüfung ist eine Kategorie-Sitzung am oder nach dem Fälligkeitstag; bestanden ab 90 %, Antwort und Begründung richtig.
// Fällt eine Prüfung durch, geht es eine Stufe zurück, die nächste Prüfung ist am Folgetag.
// Ein Fehler in einer gemeisterten Kategorie stuft sie eine Stufe zurück (auf 3, Prüfung am Folgetag).

import { addDays, diffDays, formatDay, weekKey } from '../lib/dates';
import { rng, shuffle } from '../lib/random';
import { aufgabe, aufgabenDerKategorie, KATEGORIEN, transferAufgaben } from './daten';
import type { SAufgabe, SchwState, SKatStand, SSitzung, Stufe } from './typen';

export const BESTANDEN = 0.9;
/** Abstand in Tagen bis zur Prüfung, die von Stufe n auf n + 1 führt. */
export const PRUEF_ABSTAND: Record<number, number> = { 1: 1, 2: 3, 3: 7 };
export const SITZUNG_LAENGE = 10;
export const MISCH_LAENGE = 15;
export const MAX_KONTROLLEN_FOLGE = 2;

export type Ampel = 'rot' | 'gelb' | 'gruen';

export const STUFE_TEXT: Record<Stufe, string> = {
  0: 'noch nicht bestanden',
  1: 'Stufe 1 von 3: Prüfung nach 1 Tag',
  2: 'Stufe 2 von 3: Prüfung nach 3 Tagen',
  3: 'Stufe 3 von 3: Prüfung nach 7 Tagen',
  4: 'gemeistert',
};

export function katStand(s: SchwState, kat: string): SKatStand {
  return s.kategorien[kat] ?? { kat, stufe: 0, verlauf: [] };
}

export function ampel(st: SKatStand): Ampel {
  if (st.stufe === 4) return 'gruen';
  if (st.stufe >= 1) return 'gelb';
  return 'rot';
}

export function pruefungFaellig(st: SKatStand, today: string): boolean {
  return st.stufe >= 1 && st.stufe <= 3 && !!st.faellig && st.faellig <= today;
}

const pct = (q: number) => `${Math.round(q * 100)} %`;

/** Ergebnis einer Kategorie-Sitzung: Training (Stufe 0), Prüfung (fällig) oder freie Übung. */
export function nachKategorieSitzung(st: SKatStand, quote: number, today: string, now: number): { stand: SKatStand; meldung: string } {
  const bestanden = quote >= BESTANDEN;
  const vorher = st.stufe;
  const eintrag = (art: 'training' | 'pruefung' | 'uebung', nachher: Stufe) => ({ tag: today, zeit: now, quote, art, stufeVorher: vorher, stufeNachher: nachher });

  if (vorher === 0) {
    if (!bestanden) {
      return { stand: { ...st, verlauf: [...st.verlauf, eintrag('training', 0)] }, meldung: `${pct(quote)} richtig. Für die erste Stufe braucht es mindestens 90 Prozent, Antwort und Begründung zusammen. Übe weiter.` };
    }
    const faellig = addDays(today, PRUEF_ABSTAND[1]);
    return {
      stand: { ...st, stufe: 1, faellig, verlauf: [...st.verlauf, eintrag('training', 1)] },
      meldung: `${pct(quote)} richtig: Stufe 1 erreicht. Die erste Prüfung ist morgen fällig (${formatDay(faellig)}).`,
    };
  }

  if (pruefungFaellig(st, today)) {
    if (bestanden) {
      const nachher = (vorher + 1) as Stufe;
      if (nachher === 4) {
        return {
          stand: { ...st, stufe: 4, faellig: undefined, gemeistertAm: today, verlauf: [...st.verlauf, eintrag('pruefung', 4)] },
          meldung: `${pct(quote)} richtig: Prüfung bestanden. Die Kategorie ist gemeistert – an drei Tagen mit wachsendem Abstand sicher gelöst.`,
        };
      }
      const faellig = addDays(today, PRUEF_ABSTAND[nachher]);
      return {
        stand: { ...st, stufe: nachher, faellig, verlauf: [...st.verlauf, eintrag('pruefung', nachher)] },
        meldung: `${pct(quote)} richtig: Prüfung bestanden, Stufe ${nachher}. Die nächste Prüfung ist in ${PRUEF_ABSTAND[nachher]} Tagen fällig (${formatDay(faellig)}).`,
      };
    }
    const nachher = (vorher - 1) as Stufe;
    const faellig = nachher >= 1 ? addDays(today, 1) : undefined;
    return {
      stand: { ...st, stufe: nachher, faellig, verlauf: [...st.verlauf, eintrag('pruefung', nachher)] },
      meldung: `${pct(quote)} richtig: Prüfung nicht bestanden, zurück auf ${nachher === 0 ? 'den Anfang. Bestehe zuerst wieder ein Training mit 90 Prozent' : `Stufe ${nachher}. Die nächste Prüfung ist morgen`}.`,
    };
  }

  return {
    stand: { ...st, verlauf: [...st.verlauf, eintrag('uebung', vorher)] },
    meldung:
      vorher === 4
        ? `${pct(quote)} richtig. Die Kategorie bleibt gemeistert, solange kein Fehler passiert.`
        : `${pct(quote)} richtig. Das war eine Übungsrunde; die Prüfung ist erst am ${formatDay(st.faellig ?? today)} fällig.`,
  };
}

/** Ein Fehler in einer gemeisterten Kategorie stuft sie eine Stufe zurück. */
export function nachFehler(st: SKatStand, today: string, now: number): SKatStand {
  if (st.stufe !== 4) return st;
  return {
    ...st,
    stufe: 3,
    faellig: addDays(today, 1),
    gemeistertAm: undefined,
    verlauf: [...st.verlauf, { tag: today, zeit: now, quote: 0, art: 'rueckstufung', stufeVorher: 4, stufeNachher: 3 }],
  };
}

// ---------- Fehlerzählung ----------

/** Fehler je Kategorie in den letzten `tage` Tagen (Antworten und eingetragene Fehler aus Texten, diese doppelt). */
export function fehlerJeKat(s: SchwState, today: string, tage = 14): Map<string, number> {
  const m = new Map<string, number>();
  const add = (k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);
  for (const v of s.versuche) {
    if (v.richtig || diffDays(today, v.tag) >= tage) continue;
    if (v.kat === 'T') for (const k of v.fehlerKats ?? []) add(k, 1);
    else add(v.kat, 1);
  }
  for (const e of s.eintraege) if (diffDays(today, e.tag) < tage) add(e.kat, 2);
  return m;
}

/** Gewicht einer Kategorie im gemischten Training: Wiederholte Fehler und fällige Prüfungen erscheinen häufiger. */
export function gewicht(s: SchwState, kat: string, today: string, fehler = fehlerJeKat(s, today)): number {
  const st = katStand(s, kat);
  let w = 1 + 2 * (fehler.get(kat) ?? 0);
  if (pruefungFaellig(st, today)) w += 3;
  if (st.stufe === 0) w += 1;
  if (st.stufe === 4) w *= 0.5;
  return w;
}

export interface Taeter {
  regel: string;
  kat: string;
  anzahl: number;
  zuletzt: string;
}

/** Wiederholungstäter: Regeln, gegen die mindestens zweimal verstoßen wurde. */
export function wiederholungstaeter(s: SchwState, n = 8): Taeter[] {
  const m = new Map<string, Taeter>();
  const add = (regel: string, kat: string, tag: string) => {
    if (!regel) return;
    const t = m.get(regel) ?? { regel, kat, anzahl: 0, zuletzt: tag };
    t.anzahl++;
    if (tag > t.zuletzt) t.zuletzt = tag;
    m.set(regel, t);
  };
  for (const v of s.versuche) {
    if (v.richtig) continue;
    if (v.regel) add(v.regel, v.kat, v.tag);
    for (const r of v.fehlerRegeln ?? []) add(r, r.split('.')[0], v.tag);
  }
  for (const e of s.eintraege) add(e.regel, e.kat, e.tag);
  return [...m.values()].filter((t) => t.anzahl >= 2).sort((a, b) => b.anzahl - a.anzahl || (a.zuletzt < b.zuletzt ? 1 : -1)).slice(0, n);
}

/** Die häufigsten Fehlerkategorien (für die Checkliste „Vor der Abgabe“). */
export function haeufigsteKats(s: SchwState, today: string, n = 3): string[] {
  let m = fehlerJeKat(s, today, 30);
  if (m.size < n) {
    const alle = fehlerJeKat(s, today, 100000);
    for (const [k, v] of alle) if (!m.has(k)) m.set(k, v / 10);
    m = new Map(m);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

/** Anteil richtiger Antworten je Woche (Antwort und Begründung). */
export function wochenQuote(s: SchwState, today: string, wochen = 10): { woche: string; aufgaben: number; richtig: number }[] {
  const start = weekKey(addDays(today, -7 * (wochen - 1)));
  const out: { woche: string; aufgaben: number; richtig: number }[] = [];
  for (let i = 0; i < wochen; i++) out.push({ woche: addDays(start, 7 * i), aufgaben: 0, richtig: 0 });
  for (const v of s.versuche) {
    const w = out.find((x) => x.woche === weekKey(v.tag));
    if (!w) continue;
    w.aufgaben++;
    if (v.richtig) w.richtig++;
  }
  return out;
}

// ---------- Aufgabenwahl ----------

function zuletztGesehen(s: SchwState): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of s.versuche) m.set(v.taskId, Math.max(m.get(v.taskId) ?? 0, v.zeit));
  return m;
}

function fehlerRegeln(s: SchwState, today: string): Set<string> {
  const r = new Set<string>();
  for (const v of s.versuche) if (!v.richtig && v.regel && diffDays(today, v.tag) < 30) r.add(v.regel);
  for (const e of s.eintraege) if (diffDays(today, e.tag) < 60) r.add(e.regel);
  return r;
}

/** Kandidaten nach Vorrang: eigene ungeübte Aufgaben, Regeln mit Fehlern, lange nicht gesehen. */
function rangfolge(pool: SAufgabe[], s: SchwState, today: string, seed: string): SAufgabe[] {
  const gesehen = zuletztGesehen(s);
  const fehler = fehlerRegeln(s, today);
  const rand = rng(seed);
  const tagStart = new Date(`${today}T00:00:00`).getTime();
  return pool
    .map((a) => {
      const t = gesehen.get(a.id) ?? 0;
      let p = 0;
      if (a.geprueft === false && t < tagStart) p += 4;
      if (fehler.has(a.regel)) p += 2;
      if (!t) p += 1;
      return { a, p, t, r: rand() };
    })
    .sort((x, y) => y.p - x.p || x.t - y.t || x.r - y.r)
    .map((x) => x.a);
}

/** Zehn Aufgaben einer Kategorie: jede Übungsform mindestens einmal, höchstens vier derselben Form. */
export function kategorieAufgaben(s: SchwState, kat: string, today: string, seed: string, n = SITZUNG_LAENGE): string[] {
  const sortiert = rangfolge(aufgabenDerKategorie(kat, s.eigene), s, today, seed);
  const out: SAufgabe[] = [];
  const jeTyp = new Map<string, number>();
  for (const a of sortiert) {
    if (out.length >= n || jeTyp.has(a.typ)) continue;
    jeTyp.set(a.typ, 1);
    out.push(a);
  }
  for (const a of sortiert) {
    if (out.length >= n) break;
    if (out.includes(a)) continue;
    const k = jeTyp.get(a.typ) ?? 0;
    if (k >= 4) continue;
    jeTyp.set(a.typ, k + 1);
    out.push(a);
  }
  for (const a of sortiert) if (out.length < n && !out.includes(a)) out.push(a);
  return shuffle(out, rng(`${seed}:mix`)).map((a) => a.id);
}

/** Kontrollaufgabe nach einem Fehler: dieselbe Kategorie, möglichst dieselbe Regel, noch nicht in der Sitzung. */
export function kontrollAufgabe(s: SchwState, sitzung: SSitzung, falsch: SAufgabe, today: string): string | null {
  if (falsch.kat === 'T') return null;
  const belegt = new Set(sitzung.items.map((i) => i.taskId));
  const pool = aufgabenDerKategorie(falsch.kat, s.eigene).filter((a) => !belegt.has(a.id) && a.id !== falsch.id);
  if (!pool.length) return null;
  const gleicheRegel = pool.filter((a) => a.regel === falsch.regel);
  const sortiert = rangfolge(gleicheRegel.length ? gleicheRegel : pool, s, today, `kontrolle:${falsch.id}:${sitzung.items.length}`);
  return sortiert[0]?.id ?? null;
}

/** Gemischtes Training: Kategorien nach Gewicht, dazu zwei Transfer-Absätze. */
export function mischAufgaben(s: SchwState, today: string, seed: string, n = MISCH_LAENGE): string[] {
  const rand = rng(seed);
  const fehler = fehlerJeKat(s, today);
  const kats = KATEGORIEN.map((k) => ({ kat: k.id, w: gewicht(s, k.id, today, fehler) }));
  const benutzt = new Set<string>();
  const out: { id: string; kat: string }[] = [];
  const ziel = n - 2;
  let schutz = 0;
  while (out.length < ziel && schutz++ < 200) {
    const summe = kats.reduce((x, k) => x + k.w, 0);
    let r = rand() * summe;
    const k = kats.find((x) => (r -= x.w) <= 0) ?? kats[kats.length - 1];
    const pool = aufgabenDerKategorie(k.kat, s.eigene).filter((a) => !benutzt.has(a.id));
    const a = rangfolge(pool, s, today, `${seed}:${out.length}`)[0];
    if (!a) continue;
    benutzt.add(a.id);
    out.push({ id: a.id, kat: k.kat });
  }
  // Gleiche Kategorien nicht direkt hintereinander
  const gemischt = shuffle(out, rand);
  for (let i = 1; i < gemischt.length; i++) {
    if (gemischt[i].kat !== gemischt[i - 1].kat) continue;
    const j = gemischt.findIndex((x, k) => k > i && x.kat !== gemischt[i - 1].kat && (k + 1 >= gemischt.length || gemischt[k + 1]?.kat !== gemischt[i].kat));
    if (j > 0) [gemischt[i], gemischt[j]] = [gemischt[j], gemischt[i]];
  }
  const transfer = rangfolge(transferAufgaben(), s, today, `${seed}:t`).slice(0, 2).map((a) => a.id);
  const ids = gemischt.map((x) => x.id);
  if (transfer[0]) ids.splice(Math.floor(ids.length / 2), 0, transfer[0]);
  if (transfer[1]) ids.push(transfer[1]);
  return ids;
}

export function transferAuswahl(s: SchwState, today: string, seed: string, n = 5): string[] {
  return rangfolge(transferAufgaben(), s, today, seed).slice(0, n).map((a) => a.id);
}

export function sitzungsQuote(sitz: SSitzung): number {
  if (!sitz.ergebnisse.length) return 0;
  return sitz.ergebnisse.filter((e) => e.richtig).length / sitz.ergebnisse.length;
}

/** Wie viele Kontrollaufgaben stehen unmittelbar vor Position i? */
export function kontrollFolge(sitz: SSitzung, i: number): number {
  let n = 0;
  for (let k = i; k >= 0 && sitz.items[k]?.kontrolle; k--) n++;
  return n;
}

export { aufgabe };
