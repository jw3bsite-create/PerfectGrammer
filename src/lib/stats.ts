// Kennzahlen und Verläufe.

import { addDays, dayKey, diffDays, weekKey } from './dates';
import { units } from './mastery';
import type { Attempt } from './types';

export function practiceDays(attempts: Attempt[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of attempts) m.set(a.tag, (m.get(a.tag) ?? 0) + 1);
  return m;
}

/** Serie aufeinanderfolgender Übungstage; ein heute noch offener Tag unterbricht sie nicht. */
export function streak(attempts: Attempt[], today = dayKey()): { tage: number; heuteGeuebt: boolean } {
  const days = practiceDays(attempts);
  const heuteGeuebt = days.has(today);
  let d = heuteGeuebt ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return { tage: n, heuteGeuebt };
}

export function todayCount(attempts: Attempt[], today = dayKey()): number {
  let n = 0;
  for (let i = attempts.length - 1; i >= 0; i--) {
    if (attempts[i].tag === today) n++;
    else if (attempts[i].tag < today) break;
  }
  return n;
}

export interface WeekPoint {
  woche: string;
  aufgaben: number;
  richtig: number;
  falsch: number;
}

/** Wochenwerte der letzten n Wochen (Einzelaufgaben, Textaufgaben zerlegt). */
export function weekly(attempts: Attempt[], filter: (a: Attempt) => boolean, wochen = 12, today = dayKey()): WeekPoint[] {
  const start = weekKey(addDays(today, -7 * (wochen - 1)));
  const map = new Map<string, WeekPoint>();
  for (let i = 0; i < wochen; i++) {
    const w = addDays(start, 7 * i);
    map.set(w, { woche: w, aufgaben: 0, richtig: 0, falsch: 0 });
  }
  for (const a of attempts) {
    if (a.tag < start || !filter(a)) continue;
    const p = map.get(weekKey(a.tag));
    if (!p) continue;
    for (const u of units(a)) {
      p.aufgaben++;
      if (u.richtig) p.richtig++;
      else p.falsch++;
    }
  }
  return [...map.values()];
}

export interface Rate {
  aufgaben: number;
  richtig: number;
}

export function rateBy<K>(attempts: Attempt[], key: (a: Attempt) => K | undefined, tage?: number, today = dayKey()): Map<K, Rate> {
  const m = new Map<K, Rate>();
  for (const a of attempts) {
    if (tage !== undefined && diffDays(today, a.tag) >= tage) continue;
    const k = key(a);
    if (k === undefined) continue;
    const r = m.get(k) ?? { aufgaben: 0, richtig: 0 };
    for (const u of units(a)) {
      r.aufgaben++;
      if (u.richtig) r.richtig++;
    }
    m.set(k, r);
  }
  return m;
}
