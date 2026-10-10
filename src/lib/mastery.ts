// Beherrschungsgrade je Lektion und Kursabschluss.
//
// Neu: noch nicht begonnen.
// In Arbeit: Regelkarte gelesen, Übung begonnen.
// Sicher: Lektionstest mit mindestens 9 von 10 bestanden.
// Gemeistert: mindestens 19 der letzten 20 Aufgaben richtig, verteilt auf mindestens drei verschiedene Tage.
// Rückstufung: Fällt die Quote in der Wiederholung unter 80 Prozent der letzten zehn Aufgaben, zurück auf „In Arbeit“.

import type { Attempt, Kontext, LessonState, Level, TestResult } from './types';

export const WIEDERHOLUNG_KONTEXTE: Kontext[] = ['wiederholung', 'misch', 'gezielt', 'klausur'];

export const LEVEL_LABEL: Record<Level, string> = {
  neu: 'Neu',
  inArbeit: 'In Arbeit',
  sicher: 'Sicher',
  gemeistert: 'Gemeistert',
};

export const LEVEL_RANK: Record<Level, number> = { neu: 0, inArbeit: 1, sicher: 2, gemeistert: 3 };

export interface Unit {
  richtig: boolean;
  tag: string;
  zeit: number;
  kontext: Kontext;
  fehlertyp: string;
  lektion: string;
  kurs: number;
  taskId: string;
  attemptId: string;
}

/** Zerlegt Versuche mit Teilergebnissen (Textwiedergabe, Korrekturtext) in Einzelaufgaben. */
export function units(a: Attempt): Unit[] {
  const base = { tag: a.tag, zeit: a.zeit, kontext: a.kontext, lektion: a.lektion, kurs: a.kurs, taskId: a.taskId, attemptId: a.id };
  if (a.teile && a.teile.length && !a.uebersteuert) {
    return a.teile.map((t) => ({ ...base, richtig: t.richtig, fehlertyp: t.fehlertyp }));
  }
  return [{ ...base, richtig: a.richtig, fehlertyp: a.fehlertyp }];
}

export function emptyLessonState(lektion: string): LessonState {
  return { lektion, stufe: 'neu', tests: [] };
}

export function meetsGemeistert(lessonUnits: Unit[]): boolean {
  if (lessonUnits.length < 20) return false;
  const last = lessonUnits.slice(-20);
  const correct = last.filter((u) => u.richtig).length;
  const days = new Set(last.map((u) => u.tag)).size;
  return correct >= 19 && days >= 3;
}

export interface MasteryUpdate {
  state: LessonState;
  notice?: string;
}

/**
 * Aktualisiert den Lektionsstand nach einer Antwort.
 * lessonAttempts: alle Versuche der Lektion einschließlich des neuen, zeitlich sortiert.
 */
export function afterAttempt(prev: LessonState, lessonAttempts: Attempt[], latest: Attempt, lessonTitle: string): MasteryUpdate {
  let state: LessonState = { ...prev, zuletzt: latest.zeit };
  if (state.stufe === 'neu' && latest.kontext !== 'einstufung') {
    state = { ...state, stufe: 'inArbeit', begonnen: state.begonnen ?? latest.zeit };
  }
  const all = lessonAttempts.flatMap(units);

  // Rückstufung nach schwacher Wiederholung.
  if ((state.stufe === 'sicher' || state.stufe === 'gemeistert') && WIEDERHOLUNG_KONTEXTE.includes(latest.kontext)) {
    const since = Math.max(state.sicherSeit ?? 0, state.rueckgestuftAm ?? 0);
    const review = all.filter((u) => WIEDERHOLUNG_KONTEXTE.includes(u.kontext) && u.zeit >= since).slice(-10);
    const wrong = review.filter((u) => !u.richtig).length;
    if (wrong >= 3) {
      const right = review.length - wrong;
      state = { ...state, stufe: 'inArbeit', rueckgestuftAm: latest.zeit, gemeistertSeit: undefined };
      return {
        state,
        notice: `Lektion ${state.lektion} „${lessonTitle}“ ist zurückgestuft auf „In Arbeit“: In der Wiederholung waren nur ${right} von ${review.length} Aufgaben richtig. Schreib den Lektionstest erneut, um wieder „Sicher“ zu erreichen.`,
      };
    }
  }

  if (state.stufe === 'sicher' && meetsGemeistert(all)) {
    state = { ...state, stufe: 'gemeistert', gemeistertSeit: latest.zeit };
  }
  return { state };
}

/** Wertet einen abgeschlossenen Lektionstest aus. */
export function afterTest(prev: LessonState, result: TestResult, lessonAttempts: Attempt[]): LessonState {
  let state: LessonState = { ...prev, tests: [...prev.tests, result], phase: 'test', zuletzt: result.zeit };
  if (result.bestanden && LEVEL_RANK[state.stufe] < LEVEL_RANK.sicher) {
    state = { ...state, stufe: 'sicher', sicherSeit: result.zeit };
  }
  if (state.stufe === 'sicher' && meetsGemeistert(lessonAttempts.flatMap(units))) {
    state = { ...state, stufe: 'gemeistert', gemeistertSeit: result.zeit };
  }
  return state;
}

export function testBestanden(richtig: number, gesamt: number, wertung: 'aufgaben' | 'teile' = 'aufgaben'): boolean {
  if (gesamt <= 0) return false;
  if (wertung === 'aufgaben' && gesamt === 10) return richtig >= 9;
  return richtig / gesamt >= 0.9;
}

/** Kurstest: 25 gemischte Aufgaben, bestanden ab 90 Prozent. */
export function kurstestBestanden(richtig: number, gesamt: number): boolean {
  return gesamt > 0 && richtig / gesamt >= 0.9;
}
