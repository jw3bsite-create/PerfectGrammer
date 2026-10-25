// Textbank und feste Listen des Moduls „Zusammenfassen“.

import data from '../content/zusammenfassen.json';
import type { Funktion, KjRegel, Textsorte, ZArt, ZEigenerText, ZKat, ZTeil, ZText } from './typen';

export const TEXTE: ZText[] = (data as unknown as { texte: ZText[] }).texte;
const byId = new Map(TEXTE.map((t) => [t.id, t]));

export function text(id: string): ZText | undefined {
  return byId.get(id);
}

export const FUNKTIONEN: { id: Funktion; label: string }[] = [
  { id: 'anlass', label: 'Anlass, Einstieg ins Thema' },
  { id: 'gegenposition', label: 'Gegenposition darstellen' },
  { id: 'these', label: 'These, eigene Position' },
  { id: 'argument', label: 'Argument, Begründung' },
  { id: 'beispiel', label: 'Beispiel, Beleg' },
  { id: 'einwand', label: 'Einwand und Widerlegung' },
  { id: 'problem', label: 'Problem beschreiben' },
  { id: 'ursache', label: 'Ursachen nennen' },
  { id: 'folge', label: 'Folgen aufzeigen' },
  { id: 'loesung', label: 'Lösung, Alternative vorschlagen' },
  { id: 'forderung', label: 'Forderung, Appell' },
  { id: 'rueckblick', label: 'Historischer Rückblick' },
  { id: 'bewertung', label: 'Bewertung' },
  { id: 'abwaegung', label: 'Abwägung, Pro und Contra' },
  { id: 'fazit', label: 'Fazit, Ausblick' },
];

export function funktionLabel(id: string): string {
  return FUNKTIONEN.find((f) => f.id === id)?.label ?? id;
}

/** Formulierungshilfen für den Hauptteil (nach dem Merkblatt). */
export const FUNKTIONSVERBEN = [
  'stellt dar',
  'erläutert',
  'informiert darüber, dass',
  'stellt die These auf, dass',
  'behauptet',
  'begründet',
  'belegt seine Ansicht mithilfe',
  'führt als Beispiel an',
  'veranschaulicht',
  'räumt ein',
  'widerspricht',
  'kritisiert',
  'warnt vor',
  'fordert',
  'appelliert an',
  'schlägt vor',
  'beruft sich auf',
  'blickt zurück',
  'gibt einen Ausblick',
  'wägt ab',
  'zieht die Schlussfolgerung',
  'fasst zusammen',
];

export const TEXTSORTEN: Textsorte[] = ['Kommentar', 'Bericht', 'Essay', 'Sachbuchauszug'];

export const KATEGORIEN: { id: ZKat; label: string; frage: string; tipp: string }[] = [
  { id: 'einleitung', label: 'Einleitung unvollständig', frage: 'Einleitung vollständig: Autor, Titel, Textsorte, Erscheinungsort und -datum, Thema, Kernaussage?', tipp: 'Höchstens zwei Sätze mit allen Angaben aus der Quellenzeile, dazu Thema und Kernaussage.' },
  { id: 'struktur', label: 'Struktur nicht erkennbar', frage: 'Struktur sichtbar: Abschnitte in der Reihenfolge des Textes, jeweils mit Funktionsverb?', tipp: 'Etwa ein Satz pro Sinnabschnitt; das Funktionsverb sagt, was der Autor dort tut.' },
  { id: 'these', label: 'These fehlt', frage: 'These enthalten?', tipp: 'Der Satz, in dem der Autor Stellung bezieht, gehört in jede Zusammenfassung.' },
  { id: 'dazugedichtet', label: 'Dazugedichtet', frage: 'Nichts dazugedichtet (kein Wort, keine Behauptung, die nicht im Text steht)?', tipp: 'Fingertest: Zeig für jedes Wort die Stelle im Text. Findest du sie nicht, streich es.' },
  { id: 'beispiel', label: 'Beispiel statt Kern', frage: 'Kern statt Beispiel wiedergegeben?', tipp: 'Frag: Was soll das Beispiel belegen? Das gehört in die Zusammenfassung, nicht das Beispiel.' },
  { id: 'rahmen', label: 'Rahmen fehlt', frage: 'Jeder Konjunktiv mit Rahmen (Redeeinleitung wie „Die Autorin behauptet“)?', tipp: 'Wiedergegebene Behauptungen brauchen einen Rahmen im Indikativ.' },
  { id: 'numerus', label: 'Konjunktiv Singular/Plural', frage: 'Singular und Plural richtig (Konjunktiv I; Plural würden + Infinitiv, außer seien/hätten)?', tipp: 'Singular: sei, habe, müsse. Plural: würden fehlen, aber seien und hätten.' },
  { id: 'modus', label: 'Modusmischung', frage: 'Keine Modusmischung (Behauptungen im Konjunktiv, Handlungen des Autors im Indikativ)?', tipp: 'Was der Autor tut, steht im Indikativ (fordert); was er behauptet, im Konjunktiv (sei).' },
  { id: 'praeteritum', label: 'Präteritum', frage: 'Kein Präteritum?', tipp: 'Die Textwiedergabe steht im Präsens: Der Autor stellt dar, nicht stellte dar.' },
  { id: 'abschwaechung', label: 'Abschwächung', frage: 'Keine Abschwächung (müssen nicht zu sollte, fordert nicht zu empfiehlt)?', tipp: 'Gib die Stärke der Aussage genau wieder: Ein „muss“ bleibt eine Forderung.' },
  { id: 'umgangssprache', label: 'Umgangssprache', frage: 'Keine Umgangssprache, keine Zeichen und Zeilenangaben?', tipp: 'Sachlich und schriftsprachlich: zunächst statt erstmal, Prozent statt %.' },
  { id: 'laenge', label: 'Zu lang', frage: 'Länge im Rahmen (knapp, etwa zehn Sätze)?', tipp: 'Knapp bleiben: Einleitung, etwa ein Satz pro Abschnitt, Schluss.' },
];

export function katLabel(k: ZKat): string {
  return KATEGORIEN.find((x) => x.id === k)?.label ?? k;
}

export const ARTEN: { id: ZArt; teil: ZTeil; titel: string; kurz: string; kats: ZKat[] }[] = [
  { id: 'textsorte', teil: 'einleitung', titel: 'Textsorte bestimmen', kurz: 'Kommentar, Bericht, Essay oder Sachbuchauszug?', kats: ['einleitung'] },
  { id: 'einleitungPruefen', teil: 'einleitung', titel: 'Einleitung prüfen', kurz: 'Was fehlt oder stimmt nicht?', kats: ['einleitung'] },
  { id: 'einleitungSchreiben', teil: 'einleitung', titel: 'Einleitung schreiben', kurz: 'Höchstens zwei Sätze mit allen Angaben.', kats: ['einleitung'] },
  { id: 'struktur', teil: 'hauptteil', titel: 'Struktur erkennen', kurz: 'Sinnabschnitte bilden und ihre Funktion bestimmen.', kats: ['struktur'] },
  { id: 'these', teil: 'hauptteil', titel: 'These finden', kurz: 'Den Satz antippen, in dem der Autor Stellung bezieht.', kats: ['these'] },
  { id: 'kernBeispiel', teil: 'hauptteil', titel: 'Kern oder Beispiel', kurz: 'Gibt der Satz den Kern wieder oder nur ein Beispiel?', kats: ['beispiel'] },
  { id: 'funktionsverb', teil: 'hauptteil', titel: 'Funktionsverb', kurz: 'Das Verb wählen, das trifft, was der Autor tut.', kats: ['abschwaechung', 'struktur'] },
  { id: 'fingertest', teil: 'hauptteil', titel: 'Fingertest', kurz: 'Das dazugedichtete Wort markieren.', kats: ['dazugedichtet'] },
  { id: 'synonym', teil: 'hauptteil', titel: 'Bedeutungsgleich?', kurz: 'Sagt das Ersatzwort genau dasselbe?', kats: ['dazugedichtet'] },
  { id: 'konjunktiv', teil: 'hauptteil', titel: 'Konjunktiv im Rahmen', kurz: 'Einen Satz in indirekte Rede bringen und begründen.', kats: ['numerus', 'modus'] },
  { id: 'verdichten', teil: 'hauptteil', titel: 'Abschnitt zusammenfassen', kurz: 'Ein kurzer Abschnitt, du fasst ihn in einem Satz zusammen.', kats: ['beispiel', 'dazugedichtet', 'laenge'] },
  { id: 'schlussWaehlen', teil: 'schluss', titel: 'Gesamtaussage wählen', kurz: 'Welcher Schlusssatz trifft die Gesamtaussage?', kats: ['beispiel', 'dazugedichtet'] },
  { id: 'schlussSchreiben', teil: 'schluss', titel: 'Schluss schreiben', kurz: 'Die Gesamtaussage in ein bis zwei Sätzen.', kats: ['beispiel', 'dazugedichtet'] },
];

export function art(id: ZArt) {
  return ARTEN.find((a) => a.id === id)!;
}

export const TEILE: { id: ZTeil; titel: string }[] = [
  { id: 'einleitung', titel: 'Einleitung' },
  { id: 'hauptteil', titel: 'Hauptteil' },
  { id: 'schluss', titel: 'Schluss' },
];

export const REGELN: { id: KjRegel | 'indikativ'; text: string }[] = [
  { id: 'k1', text: 'Singular: Konjunktiv I, weil er sich vom Indikativ unterscheidet' },
  { id: 'wuerde', text: 'Plural: würden + Infinitiv, weil der Konjunktiv I dem Indikativ gleicht' },
  { id: 'seienhaetten', text: 'Plural von sein und haben: seien oder hätten' },
  { id: 'indikativ', text: 'Indikativ, weil der Satz eine Handlung des Autors wiedergibt' },
];

export const BEREICH_LABEL: Record<string, string> = {
  schule: 'Schule',
  gesellschaft: 'Gesellschaft',
  politik: 'Politik',
  wirtschaft: 'Wirtschaft',
  technik: 'Technik',
  umwelt: 'Umwelt',
  sprache: 'Sprache',
  literatur: 'Literatur',
  epochen: 'Literaturepochen',
  philosophie: 'Philosophie',
  geschichte: 'Geschichte',
};

// ---------- Hilfen ----------

export function alleSaetze(t: ZText): string[] {
  return t.absaetze.flat();
}

export function volltext(t: ZText): string {
  return t.absaetze.map((a) => a.join(' ')).join('\n\n');
}

export function abschnittText(t: ZText, i: number): string[][] {
  const a = t.abschnitte[i];
  return t.absaetze.slice(a.von, a.bis + 1);
}

export function abschnittVonAbsatz(t: ZText, absatz: number): number {
  return t.abschnitte.findIndex((a) => a.von <= absatz && absatz <= a.bis);
}

export function nachname(autor: string): string {
  return autor.trim().split(/\s+/).pop() ?? autor;
}

/** Quellenzeile wie auf dem Arbeitsblatt. */
export function quellenzeile(t: ZText): string {
  return `${t.autor}: ${t.titel}. ${t.medium}, ${t.datum}. Übungstext, Verfasser und Medium erfunden.`;
}

export function musterSaetze(t: ZText): { teil: string; label: string; text: string }[] {
  return [
    { teil: 'einleitung', label: 'Einleitung', text: t.einleitung },
    ...t.abschnitte.map((a, i) => ({ teil: 'hauptteil', label: `Abschnitt ${i + 1}: ${funktionLabel(a.funktion)} (${a.verb})`, text: a.muster })),
    { teil: 'schluss', label: 'Schluss', text: t.schluss },
  ];
}

export function musterGesamt(t: ZText): string {
  return [t.einleitung, t.abschnitte.map((a) => a.muster).join(' '), t.schluss].join('\n\n');
}

export function woerter(s: string): number {
  return (s.match(/\S+/g) ?? []).length;
}

export function saetze(s: string): number {
  return (s.trim().match(/(?<!\d)(?<!\b\w)[.!?](?=\s+[A-ZÄÖÜ„]|\s*$)/g) ?? []).length;
}

/** Eigener Text als Absätze. */
export function eigeneAbsaetze(t: ZEigenerText): string[] {
  return t.text
    .split(/\n\s*\n/)
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
