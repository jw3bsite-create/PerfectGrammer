// Lädt die Aufgabenbank aus den Kursdateien (src/content/kurs-*.json).
// Neue Kursdateien und neue Aufgaben werden ohne Codeänderung erkannt.

import type { Course, CourseFile, Lesson, Task } from './types';
import { ERR_SRC } from './markup';

const files = import.meta.glob<CourseFile>('../content/kurs-*.json', { eager: true, import: 'default' });

export interface Bank {
  courses: Course[];
  lessons: Map<string, Lesson>;
  tasks: Map<string, Task>;
  byLesson: Map<string, Task[]>;
  byType: Map<string, Task[]>;
}

function buildBank(): Bank {
  const courses: Course[] = [];
  const lessons = new Map<string, Lesson>();
  const tasks = new Map<string, Task>();
  const byLesson = new Map<string, Task[]>();
  const byType = new Map<string, Task[]>();
  for (const path of Object.keys(files).sort()) {
    const f = files[path];
    const kurs = f.kurs.id;
    const ls: Lesson[] = f.lektionen.map((l) => ({ ...l, kurs }));
    courses.push({ ...f.kurs, lektionen: ls });
    for (const l of ls) {
      lessons.set(l.id, l);
      byLesson.set(l.id, []);
    }
    for (const raw of f.aufgaben as Task[]) {
      const t = { ...raw, kurs, geprueft: raw.geprueft ?? true, herkunft: raw.herkunft ?? 'bank' } as Task;
      tasks.set(t.id, t);
      byLesson.get(t.lektion)?.push(t);
    }
  }
  courses.sort((a, b) => a.reihenfolge - b.reihenfolge);
  for (const t of tasks.values()) addByType(byType, t);
  return { courses, lessons, tasks, byLesson, byType };
}

function addByType(map: Map<string, Task[]>, t: Task) {
  const types = new Set<string>([t.fehlertyp]);
  // Aufgaben mit mehreren Fehlerstellen zählen für jeden enthaltenen Typ.
  if (t.typ === 'fehler' || t.typ === 'fehlertyp' || t.typ === 'korrektur') {
    for (const m of t.text.matchAll(new RegExp(ERR_SRC, 'g'))) if (m[3] && m[3].trim() !== 'frei') types.add(m[3].trim());
  }
  for (const ty of types) {
    if (!map.has(ty)) map.set(ty, []);
    map.get(ty)!.push(t);
  }
}

export const BANK: Bank = buildBank();

let customTasks: Task[] = [];
let customById = new Map<string, Task>();

/** Eigene Aufgaben (aus dem Fehlerbuch, eigene Wörter) mit der Bank zusammenführen. */
export function setCustomTasks(list: Task[]) {
  customTasks = list;
  customById = new Map(list.map((t) => [t.id, t]));
}

export function getTask(id: string): Task | undefined {
  return BANK.tasks.get(id) ?? customById.get(id);
}

export function getLesson(id: string): Lesson | undefined {
  return BANK.lessons.get(id);
}

export function getCourse(id: number): Course | undefined {
  return BANK.courses.find((c) => c.id === id);
}

export function lessonTasks(lessonId: string, withCustom = true): Task[] {
  const base = BANK.byLesson.get(lessonId) ?? [];
  if (!withCustom) return base;
  return base.concat(customTasks.filter((t) => t.lektion === lessonId));
}

export function typeTasks(typeId: string): Task[] {
  const base = BANK.byType.get(typeId) ?? [];
  return base.concat(customTasks.filter((t) => t.fehlertyp === typeId));
}

export function allTasks(): Task[] {
  return [...BANK.tasks.values(), ...customTasks];
}

export function courseTasks(courseId: number): Task[] {
  return allTasks().filter((t) => t.kurs === courseId);
}

export function lessonAblauf(l: Lesson) {
  return l.ablauf ?? { gefuehrt: 5, frei: (BANK.byLesson.get(l.id)?.length ?? 0) >= 25 ? 15 : 12, test: 10, wertung: 'aufgaben' as const };
}

/** Kurztext einer Aufgabe für Listen und das Fehlerbuch. */
export function taskPrompt(t: Task): string {
  switch (t.typ) {
    case 'probe':
    case 'komma':
      return t.text.replace(/[{}]/g, '').replace(/\(,\)/g, '').replace(/,/g, '');
    case 'eintippen':
      return t.text.replace('___', t.hinweis ? `___ (${t.hinweis})` : '___');
    case 'entscheiden':
      return `${t.text} (${t.optionen.join(' / ')})`;
    case 'umformen':
      return t.vorlage;
    case 'fehler':
    case 'fehlertyp':
    case 'korrektur':
      return t.text.replace(new RegExp(ERR_SRC, 'g'), '$1');
    case 'wort':
      return t.umschreibung;
    case 'textwiedergabe':
      return t.vorlage;
  }
}

/** Lösung einer Aufgabe als Text (für Listen, Zeitablauf und das Fehlerbuch). */
export function solutionText(t: Task): string {
  switch (t.typ) {
    case 'probe':
    case 'komma':
      return t.text.replace(/[{}]/g, '').replace(/\(,\)/g, '');
    case 'eintippen':
    case 'entscheiden':
      return t.text.replace('___', t.loesungen[0]);
    case 'umformen':
      return t.loesungen[0];
    case 'fehler':
    case 'fehlertyp':
    case 'korrektur':
      return t.text.replace(new RegExp(ERR_SRC, 'g'), (_m, x: string, y: string, typ?: string) => (typ?.trim() === 'frei' ? x : y));
    case 'wort':
      return t.wort;
    case 'textwiedergabe':
      return t.muster;
  }
}
