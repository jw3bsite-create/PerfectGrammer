// Aktionen des Moduls „Meine Schwächen“: alles, was den gespeicherten Stand ändert.

import { dayKey } from '../lib/dates';
import { normalizeSpaces } from '../lib/normalize';
import { uid } from '../lib/random';
import { navigate } from '../lib/router';
import { buildFehlerMarkup, getState, updateSchwaechen } from '../lib/store';
import { aufgabe, kategorie } from './daten';
import { kategorieAufgaben, katStand, kontrollAufgabe, kontrollFolge, MAX_KONTROLLEN_FOLGE, mischAufgaben, nachFehler, nachKategorieSitzung, sitzungsQuote, transferAuswahl } from './logik';
import type { SAufgabe, SchwState, SEintrag, SKatStand, SSitzung, SVersuch } from './typen';

const S = () => getState().schwaechen;

async function beginne(sitzung: Omit<SSitzung, 'id' | 'index' | 'ergebnisse' | 'gestartet'>) {
  if (!sitzung.items.length) return false;
  await updateSchwaechen((s) => ({ ...s, sitzung: { ...sitzung, id: uid(), index: 0, ergebnisse: [], gestartet: Date.now() }, letzte: undefined }));
  navigate('/schwaechen/sitzung');
  return true;
}

export function starteKategorie(kat: string) {
  const k = kategorie(kat);
  const ids = kategorieAufgaben(S(), kat, dayKey(), `${kat}:${Date.now()}`);
  return beginne({ art: 'kategorie', kat, titel: k?.titel ?? kat, items: ids.map((taskId) => ({ taskId })) });
}

export function starteMisch() {
  const ids = mischAufgaben(S(), dayKey(), `misch:${Date.now()}`);
  return beginne({ art: 'misch', titel: 'Alle Kategorien gemischt', items: ids.map((taskId) => ({ taskId })) });
}

export function starteTransfer() {
  const ids = transferAuswahl(S(), dayKey(), `transfer:${Date.now()}`);
  return beginne({ art: 'transfer', titel: 'Transfer: Absätze mit versteckten Fehlern', items: ids.map((taskId) => ({ taskId })) });
}

export interface Antwort {
  antwortOk: boolean;
  regelOk: boolean;
  antwort: string;
  gewaehlt?: string;
  /** Transfer: Kategorien mit Fehlern (übersehen, falsch korrigiert oder falsch benannt). */
  fehlerKats?: string[];
  fehlerRegeln?: string[];
}

/** Speichert eine Antwort. Bei einem Fehler folgt sofort eine ähnliche Kontrollaufgabe. Liefert, ob eine Kontrolle eingeschoben wurde. */
export async function antwortSpeichern(a: SAufgabe, r: Antwort): Promise<{ kontrolle: boolean }> {
  const now = Date.now();
  const tag = dayKey(now);
  let kontrolle = false;
  await updateSchwaechen((s) => {
    const sitz = s.sitzung;
    if (!sitz) return s;
    const item = sitz.items[sitz.index];
    const richtig = r.antwortOk && r.regelOk;
    const v: SVersuch = {
      id: uid(),
      zeit: now,
      tag,
      taskId: a.id,
      kat: a.kat,
      regel: a.regel || undefined,
      gewaehlt: r.gewaehlt,
      antwortOk: r.antwortOk,
      regelOk: r.regelOk,
      richtig,
      antwort: r.antwort,
      sitzung: sitz.id,
      ...(item?.kontrolle ? { kontrolle: true } : {}),
      ...(r.fehlerKats?.length ? { fehlerKats: r.fehlerKats } : {}),
      ...(r.fehlerRegeln?.length ? { fehlerRegeln: r.fehlerRegeln } : {}),
    };
    const kategorien = { ...s.kategorien };
    const vorher: Record<string, SKatStand | null> = {};
    if (!richtig) {
      const betroffen = a.kat === 'T' ? (r.fehlerKats ?? []) : [a.kat];
      for (const k of betroffen) {
        vorher[k] = s.kategorien[k] ?? null;
        kategorien[k] = nachFehler(katStand(s, k), tag, now);
      }
    }
    const items = [...sitz.items];
    if (!richtig && kontrollFolge(sitz, sitz.index) < MAX_KONTROLLEN_FOLGE) {
      const k = kontrollAufgabe(s, sitz, a, tag);
      if (k) {
        items.splice(sitz.index + 1, 0, { taskId: k, kontrolle: true });
        kontrolle = true;
      }
    }
    const ergebnisse = [...sitz.ergebnisse, { taskId: a.id, kat: a.kat, richtig, ...(item?.kontrolle ? { kontrolle: true } : {}) }];
    const undo = !richtig && r.regelOk ? { versuchId: v.id, kategorien: vorher, kontrolle } : undefined;
    return { ...s, kategorien, versuche: [...s.versuche, v], sitzung: { ...sitz, items, index: sitz.index + 1, ergebnisse, undo } };
  });
  return { kontrolle };
}

/** Die eigene Fassung war auch richtig: Die letzte Antwort zählt, Rückstufung und Kontrollaufgabe entfallen. */
export async function letzteAlsRichtig(): Promise<boolean> {
  let ok = false;
  await updateSchwaechen((s) => {
    const sitz = s.sitzung;
    const u = sitz?.undo;
    if (!sitz || !u) return s;
    ok = true;
    const kategorien = { ...s.kategorien };
    for (const [k, st] of Object.entries(u.kategorien)) {
      if (st) kategorien[k] = st;
      else delete kategorien[k];
    }
    const items = [...sitz.items];
    if (u.kontrolle && items[sitz.index]?.kontrolle) items.splice(sitz.index, 1);
    const ergebnisse = sitz.ergebnisse.map((e, i) => (i === sitz.ergebnisse.length - 1 ? { ...e, richtig: true } : e));
    const versuche = s.versuche.map((v) => (v.id === u.versuchId ? { ...v, antwortOk: true, richtig: v.regelOk, uebersteuert: true } : v));
    return { ...s, kategorien, versuche, sitzung: { ...sitz, items, ergebnisse, undo: undefined } };
  });
  return ok;
}

/** Beendet die Sitzung; eine Kategorie-Sitzung zählt als Training oder Prüfung. */
export async function sitzungBeenden() {
  const now = Date.now();
  const tag = dayKey(now);
  await updateSchwaechen((s) => {
    const sitz = s.sitzung;
    if (!sitz) return s;
    const quote = sitzungsQuote(sitz);
    let meldung = `${Math.round(quote * 100)} % richtig, Antwort und Begründung zusammen.`;
    const kategorien = { ...s.kategorien };
    if (sitz.art === 'kategorie' && sitz.kat && sitz.ergebnisse.length) {
      const r = nachKategorieSitzung(katStand(s, sitz.kat), quote, tag, now);
      kategorien[sitz.kat] = r.stand;
      meldung = r.meldung;
    }
    return { ...s, kategorien, sitzung: null, letzte: { sitzung: sitz, quote, meldung, zeit: now } };
  });
}

export async function sitzungAbbrechen() {
  await updateSchwaechen((s) => ({ ...s, sitzung: null }));
}

// ---------- Fehler aus korrigierten Texten ----------

/** Wortweiser Unterschied für eine Entscheiden-Aufgabe: nur, wenn sich höchstens drei Wörter unterscheiden. */
function lueckenAufgabe(falsch: string, richtig: string): { text: string; r: string; w: string } | null {
  const a = falsch.split(' ');
  const b = richtig.split(' ');
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let q = 0;
  while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
  const ma = a.slice(p, a.length - q);
  const mb = b.slice(p, b.length - q);
  if (!ma.length || !mb.length || ma.length > 3 || mb.length > 3) return null;
  if (a.length - ma.length < 2) return null;
  return { text: [...a.slice(0, p), '___', ...a.slice(a.length - q)].join(' '), r: mb.join(' '), w: ma.join(' ') };
}

export interface NeuerFehler {
  falsch: string;
  richtig: string;
  kat: string;
  regel: string;
  quelle?: string;
}

/** Trägt einen Fehler aus einem korrigierten Text ein und macht daraus neue Aufgaben. */
export async function fehlerErfassen(e: NeuerFehler): Promise<{ eintrag: SEintrag; aufgaben: number }> {
  const now = Date.now();
  const tag = dayKey(now);
  const falsch = normalizeSpaces(e.falsch);
  const richtig = normalizeSpaces(e.richtig);
  const k = kategorie(e.kat);
  const regelText = k?.regeln.find((r) => r.id === e.regel)?.text ?? '';
  const begr = `${k?.methode.split(':')[0] ?? 'Regel'}: ${regelText} Richtig ist: ${richtig}`.trim();
  const basis = { kurs: 0, lektion: e.kat, fehlertyp: e.kat, kat: e.kat, regel: e.regel, stufe: 2 as const, geprueft: false, herkunft: 'fehlerbuch' as const };
  const neu: SAufgabe[] = [
    { ...basis, id: `eigen-${uid()}`, typ: 'fehler', text: buildFehlerMarkup(falsch, richtig, e.regel), begruendung: begr },
  ];
  const luecke = lueckenAufgabe(falsch, richtig);
  if (luecke) {
    const opts = Math.random() < 0.5 ? [luecke.r, luecke.w] : [luecke.w, luecke.r];
    neu.push({ ...basis, id: `eigen-${uid()}`, typ: 'entscheiden', text: luecke.text, optionen: opts, loesungen: [luecke.r], begruendung: begr });
  }
  const eintrag: SEintrag = { id: uid(), zeit: now, tag, falsch, richtig, kat: e.kat, regel: e.regel, quelle: e.quelle?.trim() || undefined, taskIds: neu.map((a) => a.id) };
  await updateSchwaechen((s: SchwState) => ({
    ...s,
    eintraege: [...s.eintraege, eintrag],
    eigene: [...s.eigene, ...neu],
    kategorien: { ...s.kategorien, [e.kat]: nachFehler(katStand(s, e.kat), tag, now) },
  }));
  return { eintrag, aufgaben: neu.length };
}

export async function eintragLoeschen(id: string) {
  await updateSchwaechen((s) => {
    const e = s.eintraege.find((x) => x.id === id);
    if (!e) return s;
    return { ...s, eintraege: s.eintraege.filter((x) => x.id !== id), eigene: s.eigene.filter((a) => !e.taskIds.includes(a.id)) };
  });
}

// ---------- Checkliste ----------

export async function hakenSetzen(key: string, wert: boolean) {
  await updateSchwaechen((s) => ({ ...s, haken: { ...s.haken, [key]: wert } }));
}

export async function checklisteAbschliessen(kats: string[]) {
  await updateSchwaechen((s) => ({ ...s, checklisten: [...s.checklisten, { zeit: Date.now(), kats }], haken: {} }));
}

export function aufgabeAusStand(id: string): SAufgabe | undefined {
  return aufgabe(id, S().eigene);
}
