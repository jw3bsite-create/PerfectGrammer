// Typen des Moduls „Zusammenfassen“ (strukturierte Textwiedergabe von Sachtexten).

export type Funktion =
  | 'anlass'
  | 'gegenposition'
  | 'these'
  | 'argument'
  | 'beispiel'
  | 'einwand'
  | 'problem'
  | 'ursache'
  | 'folge'
  | 'loesung'
  | 'forderung'
  | 'rueckblick'
  | 'bewertung'
  | 'abwaegung'
  | 'fazit';

export type Textsorte = 'Kommentar' | 'Bericht' | 'Essay' | 'Sachbuchauszug';

export interface ZAbschnitt {
  /** Absatzindizes, einschließlich. */
  von: number;
  bis: number;
  funktion: Funktion;
  /** Weitere vertretbare Funktionen. */
  auch?: Funktion[];
  verb: string;
  verbFalsch: { verb: string; grund: string; schwach?: boolean }[];
  /** Musterlösung des Abschnitts (1–2 Sätze). */
  muster: string;
  schluessel: string[];
}

export interface ZText {
  id: string;
  stufe: 1 | 2 | 3;
  bereich: string;
  struktur: string;
  titel: string;
  autor: string;
  textsorte: Textsorte;
  textsorteGrund: string;
  medium: string;
  datum: string;
  /** Baustein für die Einleitung: „erschienen am … in …“. */
  erschienen: string;
  /** Nominalgruppe nach „geht es um“. */
  thema: string;
  themaWoerter: string[];
  /** Nebensatz nach „dass“, ohne Punkt. */
  kernaussage: string;
  /** Absätze, jeder als Liste einzelner Sätze. */
  absaetze: string[][];
  /** Satz mit der These: [Absatz, Satz]. */
  these: [number, number];
  abschnitte: ZAbschnitt[];
  einleitung: string;
  schluss: string;
  schluessel: string[];
  fallen: { wort: string; grund: string }[];
  fingertest: { satz: string; falsch: string; grund: string }[];
  kernBeispiel: { abschnitt: number; satz: string; art: 'kern' | 'beispiel'; grund: string }[];
  synonyme: { original: string; ersatz: string; gleich: boolean; grund: string }[];
  konjunktiv: { vorlage: string; rahmen: string; loesungen: string[]; regel: KjRegel; grund: string }[];
  schlussFalsch: { satz: string; art: 'teilaspekt' | 'dazugedichtet' | 'wertung'; grund: string }[];
}

export type KjRegel = 'k1' | 'wuerde' | 'seienhaetten';

/** Fehlerkategorien; jede „Nein“-Antwort der Checkliste und jeder Fehler in einer Teilübung zählt in einer davon. */
export type ZKat =
  | 'einleitung'
  | 'struktur'
  | 'these'
  | 'dazugedichtet'
  | 'beispiel'
  | 'rahmen'
  | 'numerus'
  | 'modus'
  | 'praeteritum'
  | 'abschwaechung'
  | 'umgangssprache'
  | 'laenge';

/** Teilübungen. */
export type ZArt =
  | 'textsorte'
  | 'einleitungPruefen'
  | 'einleitungSchreiben'
  | 'struktur'
  | 'these'
  | 'kernBeispiel'
  | 'funktionsverb'
  | 'fingertest'
  | 'synonym'
  | 'konjunktiv'
  | 'verdichten'
  | 'schlussWaehlen'
  | 'schlussSchreiben';

export type ZTeil = 'einleitung' | 'hauptteil' | 'schluss';

export interface ZItem {
  art: ZArt;
  textId: string;
  /** Welche Teilaufgabe des Textes (Abschnitt, Fingertest-Satz …). */
  n: number;
}

export interface ZSitzung {
  id: string;
  titel: string;
  /** Übungsarten der Sitzung (für „Noch eine Runde“). */
  arten: ZArt[];
  /** Rücksprung nach dem Ende. */
  zurueck: string;
  items: ZItem[];
  index: number;
  ergebnisse: { art: ZArt; textId: string; richtig: boolean }[];
  gestartet: number;
}

export interface ZEreignis {
  zeit: number;
  tag: string;
  kat: ZKat;
  ok: boolean;
  quelle: ZArt | 'volltext';
  textId: string;
}

export interface ZUebung {
  zeit: number;
  tag: string;
  art: ZArt;
  textId: string;
  /** Teilaufgabe des Textes. */
  n?: number;
  richtig: boolean;
}

export interface ZPlanAbschnitt {
  /** Absätze dieses Abschnitts (vom Nutzer gruppiert). */
  von: number;
  bis: number;
  funktion: Funktion | '';
  verb: string;
  woerter: string[];
}

export type ZPhase = 'plan' | 'schreiben' | 'pruefen' | 'vergleich' | 'ueberarbeiten' | 'pruefen2' | 'fertig';

export interface ZVolltext {
  id: string;
  textId: string;
  /** Eigener Text aus dem Unterricht? */
  eigen?: boolean;
  start: number;
  ende?: number;
  phase: ZPhase;
  plan: ZPlanAbschnitt[];
  /** Absatz, an dem die These markiert wurde. */
  theseAbsatz: number | null;
  fassung1: string;
  dauer1?: number;
  check1?: Record<string, boolean>;
  fassung2?: string;
  dauer2?: number;
  check2?: Record<string, boolean>;
  ki?: string;
}

export interface ZEigenerText {
  id: string;
  zeit: number;
  titel: string;
  autor: string;
  textsorte: string;
  /** Freie Quellenangabe, etwa „erschienen am 24.09.2025 in der Weltwoche“. */
  quelle: string;
  /** Absätze, durch Leerzeilen getrennt. */
  text: string;
  /** Musterlösung der Lehrkraft (freiwillig). */
  muster?: string;
}

export interface ZKi {
  aktiv: boolean;
  /** Claude über die Anthropic-API oder ein lokales Modell: Ollama oder ein Server mit OpenAI-Schnittstelle (LM Studio, Jan, llama.cpp). */
  anbieter: 'claude' | 'ollama' | 'openai';
  /** Lokale KI: Adresse und Modell. */
  url: string;
  modell: string;
  /** Claude: Modell. Der API-Schlüssel liegt nicht hier, sondern nur im Browser (localStorage). */
  claudeModell: string;
}

export interface ZState {
  ereignisse: ZEreignis[];
  uebungen: ZUebung[];
  volltexte: ZVolltext[];
  eigeneTexte: ZEigenerText[];
  sitzung: ZSitzung | null;
  /** Zuletzt beendete Sitzung (für die Zusammenfassung am Ende). */
  letzte?: ZSitzung;
  /** Gewählte Stufe; ohne Angabe richtet sie sich nach dem Fortschritt. */
  niveau?: 1 | 2 | 3;
  ki: ZKi;
}

export function leererZStand(): ZState {
  return {
    ereignisse: [],
    uebungen: [],
    volltexte: [],
    eigeneTexte: [],
    sitzung: null,
    ki: { aktiv: false, anbieter: 'claude', url: 'http://localhost:11434', modell: 'qwen2.5:7b', claudeModell: 'claude-opus-5-5' },
  };
}
