// Typen des Moduls „Meine Schwächen“.

import type { Task, TaskBase } from '../lib/types';

export interface SRegel {
  id: string;
  text: string;
}

export interface SKategorie {
  id: string;
  titel: string;
  kurz: string;
  /** Die eine Methode der Kategorie; jede Rückmeldung erklärt mit ihr. */
  methode: string;
  /** Regeln zur Begründung (richtige Antworten). */
  regeln: SRegel[];
  /** Fehlregeln: verbreitete Irrtümer, nur als Ablenker in der Auswahl. */
  mythen: SRegel[];
  /** Verweise auf Lektionen der Kurse. */
  kurse: string[];
  /** Frage für die Checkliste „Vor der Abgabe“. */
  checkfrage: string;
  /** Die eigenen Fehler, mit denen die Kategorie begann. */
  beispiele: { falsch: string; richtig: string }[];
}

export interface SPruefung {
  label: string;
  /** Jeder dieser regulären Ausdrücke muss passen. */
  muss: string[];
  /** Keiner dieser regulären Ausdrücke darf passen. */
  nicht: string[];
}

export interface SchreibenTask extends Omit<TaskBase, 'typ'> {
  typ: 'schreiben';
  aufgabe: string;
  beispiel: string;
  gegenbeispiel?: string;
  pruefungen: SPruefung[];
}

/** Zusatzangaben jeder Aufgabe des Moduls. */
export interface SZusatz {
  /** Kategorie S1 … S12, „T“ für Transfer-Absätze. */
  kat: string;
  /** Richtige Regel (leer bei Transfer: Dort zählen die Kategorien der Stellen). */
  regel: string;
  transfer?: boolean;
}

export type SAufgabe = (Task & SZusatz) | (SchreibenTask & SZusatz);

export type Stufe = 0 | 1 | 2 | 3 | 4;

export interface SVerlauf {
  tag: string;
  zeit: number;
  quote: number;
  art: 'training' | 'pruefung' | 'uebung' | 'rueckstufung';
  stufeVorher: Stufe;
  stufeNachher: Stufe;
}

export interface SKatStand {
  kat: string;
  /** 0 neu oder zurückgefallen, 1–3 in Prüfung (nach 1, 3, 7 Tagen), 4 gemeistert. */
  stufe: Stufe;
  /** Tag der nächsten Prüfung (bei Stufe 1–3). */
  faellig?: string;
  gemeistertAm?: string;
  verlauf: SVerlauf[];
}

export interface SVersuch {
  id: string;
  zeit: number;
  tag: string;
  taskId: string;
  kat: string;
  /** Richtige Regel und gewählte Regel. */
  regel?: string;
  gewaehlt?: string;
  antwortOk: boolean;
  regelOk: boolean;
  richtig: boolean;
  antwort: string;
  sitzung: string;
  kontrolle?: boolean;
  /** Transfer: Kategorien, in denen ein Fehler gemacht wurde. */
  fehlerKats?: string[];
  /** Transfer: Regeln der übersehenen oder falsch korrigierten Stellen. */
  fehlerRegeln?: string[];
  /** Nachträglich als richtig gewertet (eigene Fassung). */
  uebersteuert?: boolean;
}

export interface SEintrag {
  id: string;
  zeit: number;
  tag: string;
  falsch: string;
  richtig: string;
  kat: string;
  regel: string;
  quelle?: string;
  taskIds: string[];
}

export interface SItem {
  taskId: string;
  kontrolle?: boolean;
}

export interface SSitzung {
  id: string;
  art: 'kategorie' | 'misch' | 'transfer';
  kat?: string;
  titel: string;
  items: SItem[];
  index: number;
  ergebnisse: { taskId: string; kat: string; richtig: boolean; kontrolle?: boolean }[];
  gestartet: number;
  /** Stand vor der letzten falschen Antwort, falls die eigene Fassung doch als richtig gilt. */
  undo?: { versuchId: string; kategorien: Record<string, SKatStand | null>; kontrolle: boolean };
}

export interface SCheckliste {
  zeit: number;
  kats: string[];
}

export interface SchwState {
  kategorien: Record<string, SKatStand>;
  versuche: SVersuch[];
  eintraege: SEintrag[];
  eigene: SAufgabe[];
  sitzung: SSitzung | null;
  /** Ergebnis der zuletzt beendeten Sitzung (für die Zusammenfassung). */
  letzte?: { sitzung: SSitzung; quote: number; meldung: string; zeit: number };
  checklisten: SCheckliste[];
  haken: Record<string, boolean>;
}

export function leererStand(): SchwState {
  return { kategorien: {}, versuche: [], eintraege: [], eigene: [], sitzung: null, checklisten: [], haken: {} };
}
