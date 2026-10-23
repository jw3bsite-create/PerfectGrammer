// Automatische Hinweise zu selbst geschriebenen Zusammenfassungen. Sie ersetzen die Selbstprüfung nicht,
// sondern zeigen Stellen, an denen sie besonders genau hinsehen sollte.

import { nachname, saetze, woerter } from './daten';
import type { ZKat, ZText } from './typen';

export interface Hinweis {
  kat: ZKat;
  text: string;
  /** Gefundene Stellen im eigenen Text. */
  stellen?: string[];
}

const UMGANGSSPRACHE = [
  'erstmal', 'erst mal', 'schlussendlich', 'kriegen', 'kriegt', 'kriegte', 'gucken', 'guckt', 'checken', 'checkt', 'krass', 'total',
  'halt', 'irgendwie', 'echt', 'mega', 'rein', 'raus', 'rüber', 'via', 'bspw.', 'usw.', 'etc.', 'BRD', 'okay', 'ok',
  'das Ganze', 'super', 'tun-Form',
];

const PRAETERITUM = [
  'war', 'waren', 'hatte', 'hatten', 'wurde', 'wurden', 'stellte', 'stellten', 'erläuterte', 'kritisierte', 'forderte', 'betonte',
  'behauptete', 'meinte', 'schrieb', 'erklärte', 'zeigte', 'beschrieb', 'verwies', 'warnte', 'fasste', 'führte', 'nannte',
  'argumentierte', 'beschäftigte', 'ging', 'gingen', 'kam', 'kamen', 'sah', 'sahen', 'gab', 'gaben', 'nahm', 'fand', 'hielt',
  'sagte', 'sagten', 'schlug', 'wies', 'machte', 'setzte', 'legte', 'brachte', 'dachte', 'wusste', 'blieb', 'lag',
];

const ABSCHWAECHUNG = ['sollte', 'sollten', 'könnte', 'könnten', 'empfiehlt', 'empfehle', 'wünscht', 'hofft', 'vielleicht', 'eventuell'];
const STARK = /\b(muss|müssen|müsse|fordert|fordern|verlangt|notwendig|unverzichtbar|zwingend|dringend)\b/i;
const WERTUNG = ['überzeugend', 'überzeugende', 'überzeugenden', 'gelungen', 'gelungene', 'gelungenen', 'interessant', 'interessante', 'interessanten', 'spannend', 'spannende', 'gut geschrieben', 'schlecht', 'meiner Meinung', 'ich finde', 'ich denke', 'leider', 'zum Glück'];

function finde(text: string, woerterListe: string[], gross = false): string[] {
  const out: string[] = [];
  for (const w of woerterListe) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, gross ? 'gu' : 'giu');
    const m = text.match(re);
    if (m) out.push(...m);
  }
  return [...new Set(out)];
}

export function umgangssprache(text: string): string[] {
  const s = finde(text, UMGANGSSPRACHE.filter((w) => w !== 'tun-Form'));
  // tun-Umschreibung: „tut … erklären“, „tun … fehlen“
  for (const m of text.matchAll(/\b(tut|tun|tat|taten)\b(?:\s+\p{L}+){0,4}\s+\p{Ll}+en\b/gu)) s.push(m[0]);
  const zeichen = text.match(/\d+\s*%|%|€|\$|&|\b\d+\.(?=\s+[a-zäöü])/g) ?? [];
  return [...s, ...zeichen];
}

export function zeilenangaben(text: string): string[] {
  return text.match(/\((?:Z|Zl|Zeile|Zeilen|S\.|vgl\.)[^)]*\)|\bZ\.\s*\d+|\bZeilen?\s+\d+/gi) ?? [];
}

export function praeteritum(text: string): string[] {
  return finde(text, PRAETERITUM);
}

export function wertungen(text: string): string[] {
  return finde(text, WERTUNG);
}

export function fallenIn(text: string, t: ZText): { wort: string; grund: string }[] {
  const low = text.toLowerCase();
  return t.fallen.filter((f) => {
    const w = f.wort.toLowerCase();
    // Wortanfang reicht: „Cybermobbings“, „Sucht“ in „Handysucht“ zählt nicht
    return new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(low);
  });
}

export function schluesselTreffer(text: string, schluessel: string[]): string[] {
  const low = text.toLowerCase();
  return schluessel.filter((k) => low.includes(k.toLowerCase().slice(0, Math.max(4, Math.min(k.length, k.length - 2)))));
}

/** Hinweise zu einer Einleitung. */
export function pruefeEinleitung(eigen: string, t: { autor: string; titel: string; textsorte: string; datum: string; medium: string; themaWoerter?: string[] }): { label: string; ok: boolean }[] {
  const low = eigen.toLowerCase();
  const jahr = t.datum.match(/\d{4}/)?.[0];
  // „Rundblick“ aus „Wochenzeitung „Rundblick““, sonst der Name vor dem Komma: „Kranich“ aus „Verlag Kranich, Leipzig“
  const medien = t.medium.match(/„([^“]+)“/g)?.map((x) => x.slice(1, -1)) ?? [t.medium.split(',')[0].trim().split(/\s+/).pop() ?? t.medium];
  const sorte = t.textsorte === 'Sachbuchauszug' ? ['sachbuch', 'auszug', 'monografie'] : [t.textsorte.toLowerCase()];
  const teile = [
    { label: `Autor (${t.autor})`, ok: low.includes(nachname(t.autor).toLowerCase()) },
    { label: `Titel „${t.titel}“`, ok: low.includes(t.titel.toLowerCase().slice(0, Math.min(18, t.titel.length))) },
    { label: `Textsorte (${t.textsorte})`, ok: sorte.some((x) => low.includes(x)) },
    { label: `Erscheinungsort (${medien.join(', ')})`, ok: medien.some((m) => low.includes(m.toLowerCase())) },
    { label: `Erscheinungsdatum (${t.datum})`, ok: !!jahr && low.includes(jahr) },
  ];
  if (t.themaWoerter?.length) teile.push({ label: 'Thema genannt', ok: t.themaWoerter.some((w) => low.includes(w.toLowerCase().slice(0, Math.max(4, w.length - 2)))) });
  teile.push({ label: 'Höchstens zwei Sätze', ok: saetze(eigen) <= 2 && saetze(eigen) >= 1 });
  return teile;
}

/** Alle Hinweise zu einer ganzen Zusammenfassung. */
export function hinweiseZusammenfassung(eigen: string, t?: ZText, musterWoerter?: number, quelltext?: string): Hinweis[] {
  const out: Hinweis[] = [];
  const u = umgangssprache(eigen);
  if (u.length) out.push({ kat: 'umgangssprache', text: 'Umgangssprache oder Zeichen gefunden', stellen: u });
  const z = zeilenangaben(eigen);
  if (z.length) out.push({ kat: 'umgangssprache', text: 'Zeilenangaben gehören nicht in die Textwiedergabe', stellen: z });
  const p = praeteritum(eigen);
  if (p.length) out.push({ kat: 'praeteritum', text: 'Mögliche Präteritumformen; prüfe, ob hier Präsens oder Konjunktiv hingehört', stellen: p });
  const w = wertungen(eigen);
  if (w.length) out.push({ kat: 'dazugedichtet', text: 'Eigene Wertung? In der Textwiedergabe steht nur, was der Text sagt', stellen: w });
  if (t) {
    const f = fallenIn(eigen, t);
    for (const x of f) out.push({ kat: 'dazugedichtet', text: `„${x.wort}“: ${x.grund}`, stellen: [x.wort] });
  }
  const quelle = quelltext ?? (t ? t.absaetze.flat().join(' ') : '');
  if (quelle && STARK.test(quelle)) {
    // Nur Wörter, die der Text selbst nicht verwendet: Sagt er „sollte“, darf man es übernehmen.
    const a = finde(eigen, ABSCHWAECHUNG).filter((w) => !finde(quelle, [w]).length);
    if (a.length) out.push({ kat: 'abschwaechung', text: 'Der Text formuliert stark (müssen, fordern). Prüfe, ob deine Wörter abschwächen', stellen: a });
  }
  const n = woerter(eigen);
  if (musterWoerter && n > musterWoerter * 1.35) out.push({ kat: 'laenge', text: `${n} Wörter, die Musterlösung hat ${musterWoerter}. Deutlich länger: Wo gibst du Beispiele oder Details wieder?` });
  const s = saetze(eigen);
  if (s > 14) out.push({ kat: 'laenge', text: `${s} Sätze; erwartet sind etwa zehn` });
  if (t) {
    const nn = nachname(t.autor).toLowerCase();
    if (!eigen.toLowerCase().includes(nn)) out.push({ kat: 'einleitung', text: `Der Name ${t.autor} kommt nicht vor` });
    if (!eigen.includes(t.titel.slice(0, Math.min(15, t.titel.length)))) out.push({ kat: 'einleitung', text: 'Der Titel kommt nicht vor' });
    const these = t.abschnitte.find((a) => a.funktion === 'these' || a.auch?.includes('these'));
    if (these && !schluesselTreffer(eigen, these.schluessel).length) out.push({ kat: 'these', text: `Kein Schlüsselbegriff des These-Abschnitts (${these.schluessel.join(', ')}). Ist die These enthalten?` });
  }
  return out;
}

/** Hinweise zu einem Satz aus einer Teilübung (Verdichten, Schluss). */
export function hinweiseSatz(eigen: string, t: ZText, schluessel: string[], maxWoerter?: number, maxSaetze?: number): Hinweis[] {
  const out: Hinweis[] = [];
  const n = woerter(eigen);
  if (maxWoerter && n > maxWoerter) out.push({ kat: 'laenge', text: `${n} Wörter, erlaubt sind höchstens ${maxWoerter}` });
  if (maxSaetze && saetze(eigen) > maxSaetze) out.push({ kat: 'laenge', text: `Mehr als ${maxSaetze === 1 ? 'ein Satz' : `${maxSaetze} Sätze`}` });
  for (const f of fallenIn(eigen, t)) out.push({ kat: 'dazugedichtet', text: `„${f.wort}“: ${f.grund}`, stellen: [f.wort] });
  const w = wertungen(eigen);
  if (w.length) out.push({ kat: 'dazugedichtet', text: 'Eigene Wertung', stellen: w });
  const u = umgangssprache(eigen);
  if (u.length) out.push({ kat: 'umgangssprache', text: 'Umgangssprache oder Zeichen', stellen: u });
  const p = praeteritum(eigen);
  if (p.length) out.push({ kat: 'praeteritum', text: 'Mögliche Präteritumformen', stellen: p });
  const treffer = schluesselTreffer(eigen, schluessel);
  if (!treffer.length && schluessel.length) out.push({ kat: 'beispiel', text: `Keiner der Schlüsselbegriffe (${schluessel.join(', ')}) kommt vor. Triffst du den Kern?` });
  return out;
}
