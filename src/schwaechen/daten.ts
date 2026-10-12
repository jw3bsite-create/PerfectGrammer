// Inhalte des Moduls und Zugriff darauf.

import data from '../content/schwaechen.json';
import type { SAufgabe, SKategorie, SRegel } from './typen';

export const KATEGORIEN: SKategorie[] = data.kategorien as SKategorie[];
export const BANK_AUFGABEN: SAufgabe[] = data.aufgaben as unknown as SAufgabe[];

const byId = new Map<string, SAufgabe>(BANK_AUFGABEN.map((a) => [a.id, a]));
const regelById = new Map<string, SRegel>();
for (const k of KATEGORIEN) for (const r of [...k.regeln, ...k.mythen]) regelById.set(r.id, r);

export function kategorie(id: string): SKategorie | undefined {
  return KATEGORIEN.find((k) => k.id === id);
}

export function regel(id: string): SRegel | undefined {
  return regelById.get(id);
}

/** Kategorie einer Regel-ID wie „S1.k3“. */
export function katVonRegel(id: string): string {
  return id.split('.')[0];
}

export function istMythos(id: string): boolean {
  return /\.m\d+$/.test(id);
}

/** Aufgabe aus der Bank oder aus den eigenen Aufgaben. */
export function aufgabe(id: string, eigene: SAufgabe[]): SAufgabe | undefined {
  return byId.get(id) ?? eigene.find((a) => a.id === id);
}

export function aufgabenDerKategorie(kat: string, eigene: SAufgabe[]): SAufgabe[] {
  return [...BANK_AUFGABEN.filter((a) => a.kat === kat), ...eigene.filter((a) => a.kat === kat)];
}

export function transferAufgaben(): SAufgabe[] {
  return BANK_AUFGABEN.filter((a) => a.kat === 'T');
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Vier Begründungen zur Auswahl: die richtige, dazu Regeln und Fehlregeln derselben Kategorie.
 * Die Reihenfolge ist je Aufgabe fest, damit sie beim Wiederholen nicht zufällig springt.
 */
export function regelOptionen(a: SAufgabe): SRegel[] {
  const k = kategorie(a.kat);
  const richtig = regel(a.regel);
  if (!k || !richtig) return richtig ? [richtig] : [];
  const andere = [...k.regeln.filter((r) => r.id !== richtig.id), ...k.mythen];
  const h = hash(a.id);
  const sortiert = andere.map((r, i) => ({ r, s: hash(`${a.id}:${r.id}:${i}`) })).sort((x, y) => x.s - y.s).map((x) => x.r);
  // Mindestens eine echte Nachbarregel, sonst wäre die richtige allein an ihrer Form erkennbar.
  const nachbarn = sortiert.filter((r) => !istMythos(r.id));
  const mythen = sortiert.filter((r) => istMythos(r.id));
  const auswahl = [...nachbarn.slice(0, 2), ...mythen].slice(0, 3);
  while (auswahl.length < 3 && sortiert.length > auswahl.length) {
    const naechste = sortiert.find((r) => !auswahl.includes(r));
    if (!naechste) break;
    auswahl.push(naechste);
  }
  const alle = [richtig, ...auswahl];
  const pos = h % alle.length;
  const out = alle.slice(1);
  out.splice(pos, 0, richtig);
  return out;
}

/** Kategorien der Fehlerstellen eines Transfer-Absatzes. */
export function transferKats(a: SAufgabe): string[] {
  if (a.typ !== 'fehler') return [];
  const kats = new Set<string>();
  for (const m of a.text.matchAll(/\[\[[^\]]*?=>[^\]]*?\|(S\d+)\.[a-z]\d+[^\]]*\]\]/g)) kats.add(m[1]);
  return [...kats].sort((x, y) => Number(x.slice(1)) - Number(y.slice(1)));
}
