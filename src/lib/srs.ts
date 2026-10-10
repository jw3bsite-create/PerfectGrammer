// Wiederholung in wachsenden Abständen: nach 1, 3, 7, 16 und 35 Tagen.
// Eine richtige Antwort auf eine fällige Aufgabe rückt eine Stufe vor, eine falsche setzt auf Stufe 1 zurück.

import { addDays } from './dates';
import type { ReviewState } from './types';

export const INTERVALLE = [1, 3, 7, 16, 35];

export function taskKey(taskId: string): string {
  return `a:${taskId}`;
}

export function typeKey(typeId: string): string {
  return `t:${typeId}`;
}

export function isDue(s: ReviewState, today: string): boolean {
  return !s.erledigt && s.faellig <= today;
}

/** Neuer Stand nach einer Antwort; undefined, wenn sich nichts ändert. */
export function nextState(
  prev: ReviewState | undefined,
  key: string,
  art: ReviewState['art'],
  ref: string,
  richtig: boolean,
  today: string,
  now: number,
): ReviewState | undefined {
  if (!richtig) {
    return { key, art, ref, stufe: 1, faellig: addDays(today, INTERVALLE[0]), aktualisiert: now, erledigt: false };
  }
  if (!prev || prev.erledigt || prev.faellig > today) return undefined;
  const stufe = prev.stufe + 1;
  if (stufe > INTERVALLE.length) return { ...prev, stufe: INTERVALLE.length, erledigt: true, aktualisiert: now };
  return { ...prev, stufe, faellig: addDays(today, INTERVALLE[stufe - 1]), aktualisiert: now };
}

/** Aufnahme in die Wiederholung ohne vorherige Antwort (z. B. nach einem Klausurfehler): sofort fällig. */
export function scheduleNow(prev: ReviewState | undefined, key: string, art: ReviewState['art'], ref: string, today: string, now: number): ReviewState {
  if (prev && !prev.erledigt && prev.faellig <= today) return prev;
  return { key, art, ref, stufe: 1, faellig: today, aktualisiert: now, erledigt: false };
}
