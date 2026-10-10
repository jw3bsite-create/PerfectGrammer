// Zentrale Typen für Inhalte und gespeicherte Daten.

export type TaskType =
  | 'probe'
  | 'komma'
  | 'eintippen'
  | 'entscheiden'
  | 'umformen'
  | 'fehler'
  | 'wort'
  | 'fehlertyp'
  | 'textwiedergabe'
  | 'korrektur';

export type Stufe = 1 | 2 | 3;

export interface TaskBase {
  id: string;
  kurs: number;
  lektion: string;
  typ: TaskType;
  fehlertyp: string;
  stufe: Stufe;
  begruendung: string;
  /** Bankaufgaben sind geprüft; Aufgaben aus dem Fehlerbuch oder der eigenen Wortliste nicht. */
  geprueft?: boolean;
  herkunft?: 'bank' | 'fehlerbuch' | 'wortliste';
}

/** Komma-Notation: {Verb} markiert gebeugte Verben, „,“ ein Pflichtkomma, „(,)“ ein freigestelltes Komma. */
export interface KommaTask extends TaskBase {
  typ: 'probe' | 'komma';
  text: string;
}

export interface EintippenTask extends TaskBase {
  typ: 'eintippen';
  /** Satz mit genau einer Lücke „___“. */
  text: string;
  /** Grundform oder Hinweis, erscheint in Klammern nach der Lücke. */
  hinweis?: string;
  loesungen: string[];
}

export interface EntscheidenTask extends TaskBase {
  typ: 'entscheiden';
  /** Satz mit genau einer Lücke „___“. */
  text: string;
  optionen: string[];
  loesungen: string[];
}

export interface UmformenTask extends TaskBase {
  typ: 'umformen';
  vorlage: string;
  loesungen: string[];
  /** Verbformen, die in jeder Lösung vorkommen; dienen der Rückmeldung. */
  kern?: string[];
}

/** Fehler-Notation: [[falsch=>richtig|fehlertyp|Begründung]]; Fehlertyp und Begründung sind optional. */
export interface FehlerTask extends TaskBase {
  typ: 'fehler' | 'fehlertyp';
  text: string;
  /** Nur für „Fehlertyp bestimmen“: Auswahl der Fehlertypen; fehlt sie, wählt die App passende aus. */
  optionen?: string[];
}

export interface WortTask extends TaskBase {
  typ: 'wort';
  wort: string;
  umschreibung: string;
  /** Weitere gültige Schreibungen. */
  varianten?: string[];
}

export interface Pruefung {
  label: string;
  /** Mindestens eines dieser Muster muss vorkommen. „…“ steht für bis zu acht Wörter. */
  erwartet: string[];
  /** Keines dieser Muster darf vorkommen. */
  vermeiden?: string[];
  fehlertyp: string;
}

export interface TextwiedergabeTask extends TaskBase {
  typ: 'textwiedergabe';
  quelle: string;
  vorlage: string;
  muster: string;
  pruefungen: Pruefung[];
}

export interface KorrekturTask extends TaskBase {
  typ: 'korrektur';
  titel: string;
  aufgabe?: string;
  text: string;
}

export type Task =
  | KommaTask
  | EintippenTask
  | EntscheidenTask
  | UmformenTask
  | FehlerTask
  | WortTask
  | TextwiedergabeTask
  | KorrekturTask;

export interface Regelkarte {
  regel: string;
  probe: string;
  beispiele: string[];
  falle: string;
}

export interface Ablauf {
  gefuehrt: number;
  frei: number;
  test: number;
  /** „teile“: Der Test zählt jede Prüfstelle einzeln (Lektion 3.7, Kurs 10). */
  wertung?: 'aufgaben' | 'teile';
}

export interface Lesson {
  id: string;
  kurs: number;
  titel: string;
  regelkarte: Regelkarte;
  ablauf?: Ablauf;
}

export interface Course {
  id: number;
  titel: string;
  kurztitel: string;
  probe: string;
  reihenfolge: number;
  beschreibung?: string;
  lektionen: Lesson[];
}

export interface CourseFile {
  kurs: Omit<Course, 'lektionen'>;
  lektionen: Omit<Lesson, 'kurs'>[];
  aufgaben: Omit<Task, 'kurs'>[] | Task[];
}

// ---------- Gespeicherte Daten ----------

export type Kontext =
  | 'gefuehrt'
  | 'frei'
  | 'test'
  | 'wiederholung'
  | 'misch'
  | 'gezielt'
  | 'klausur'
  | 'einstufung'
  | 'kurstest'
  | 'korrektur';

export interface Teilergebnis {
  fehlertyp: string;
  richtig: boolean;
  label: string;
}

export interface Attempt {
  id: string;
  taskId: string;
  kurs: number;
  lektion: string;
  fehlertyp: string;
  typ: TaskType;
  zeit: number;
  tag: string;
  antwort: string;
  loesung: string;
  richtig: boolean;
  sitzung: string;
  kontext: Kontext;
  teile?: Teilergebnis[];
  /** Als richtig gewertet, obwohl die automatische Prüfung abwich. */
  uebersteuert?: boolean;
}

export interface ReviewState {
  key: string;
  art: 'aufgabe' | 'fehlertyp';
  ref: string;
  stufe: number;
  faellig: string;
  aktualisiert: number;
  erledigt?: boolean;
}

export interface ErrorEntry {
  id: string;
  zeit: number;
  tag: string;
  herkunft: 'app' | 'arbeit';
  quelle: string;
  original: string;
  korrektur: string;
  fehlertyp: string;
  kurs: number;
  lektion: string;
  taskId?: string;
  attemptId?: string;
  aufgabe?: string;
  begruendung?: string;
  notiz?: string;
  geaendert?: number;
}

export type Level = 'neu' | 'inArbeit' | 'sicher' | 'gemeistert';

export interface TestResult {
  zeit: number;
  richtig: number;
  gesamt: number;
  bestanden: boolean;
}

export interface LessonState {
  lektion: string;
  stufe: Level;
  regelGelesen?: number;
  begonnen?: number;
  sicherSeit?: number;
  gemeistertSeit?: number;
  rueckgestuftAm?: number;
  tests: TestResult[];
  /** Zuletzt abgeschlossene Phase des Ablaufs. */
  phase?: 'regel' | 'gefuehrt' | 'frei' | 'test';
  zuletzt?: number;
}

export interface CourseState {
  kurs: number;
  einstufung?: { richtig: number; gesamt: number; zeit: number };
  kurstests: TestResult[];
}

export type Theme = 'system' | 'hell' | 'dunkel';

export interface Settings {
  sitzungslaenge: 15 | 30 | 50;
  tagesziel: number;
  zeitmodus: boolean;
  sekundenJeAufgabe: number;
  darstellung: Theme;
  schriftgroesse: 'normal' | 'gross';
  sprachausgabe: boolean;
  onboardingErledigt: boolean;
}

export type SessionArt =
  | 'lektion'
  | 'wiederholung'
  | 'misch'
  | 'gezielt'
  | 'klausur'
  | 'einstufung'
  | 'kurstest'
  | 'text';

export interface SessionItem {
  taskId: string;
  kontext: Kontext;
  /** „fehlertyp“: Aufgabe wird als „Fehlertyp bestimmen“ gestellt. */
  modus?: 'fehlertyp';
}

export interface SessionResult {
  taskId: string;
  richtig: boolean;
  attemptId: string;
  teile?: Teilergebnis[];
}

export interface Session {
  id: string;
  art: SessionArt;
  titel: string;
  lektion?: string;
  kurs?: number;
  phase?: 'gefuehrt' | 'frei' | 'test';
  items: SessionItem[];
  index: number;
  results: SessionResult[];
  gestartet: number;
  /** Für „Vor der Klausur“: Ende der Sitzung (Zeitstempel). */
  endetUm?: number;
  fehlertypen?: string[];
  kurse?: number[];
  hinweise?: string[];
}

export interface Notice {
  id: string;
  zeit: number;
  text: string;
  lektion?: string;
  gelesen?: boolean;
}

export interface AppData {
  settings: Settings;
  attempts: Attempt[];
  reviews: Record<string, ReviewState>;
  errors: ErrorEntry[];
  lessons: Record<string, LessonState>;
  courses: Record<number, CourseState>;
  customTasks: Task[];
  session: Session | null;
  /** Abgeschlossene Sitzungen für „Weiter, wo du warst“ und Auswertungen. */
  lastSession?: { art: SessionArt; lektion?: string; kurs?: number; zeit: number; titel: string; phase?: string };
  notices: Notice[];
  placementDone?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  sitzungslaenge: 30,
  tagesziel: 30,
  zeitmodus: false,
  sekundenJeAufgabe: 40,
  darstellung: 'system',
  schriftgroesse: 'normal',
  sprachausgabe: true,
  onboardingErledigt: false,
};
