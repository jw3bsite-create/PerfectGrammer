// Zusammenstellung der Sitzungen: Lektionsphasen, tägliche Wiederholung, Mischtraining,
// gezieltes Üben, Vor der Klausur, Einstufungstest, Kurstest.

import { BANK, getTask, lessonAblauf, lessonTasks, typeTasks, allTasks, getLesson } from './content';
import { FEHLERTYPEN, fehlertyp } from './fehlertypen';
import { parseFehler } from './markup';
import { rng, shuffle } from './random';
import { isDue } from './srs';
import { frequentTypes, weakestTypes } from './errorbook';
import type { AppData, Kontext, Lesson, SessionItem, Task } from './types';

export const HEAVY = new Set(['korrektur', 'textwiedergabe']);

export function recencyMap(data: AppData): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of data.attempts) m.set(a.taskId, Math.max(m.get(a.taskId) ?? 0, a.zeit));
  return m;
}

function byRecency(tasks: Task[], rec: Map<string, number>, rand: () => number): Task[] {
  const keyed = tasks.map((t) => ({ t, last: rec.get(t.id) ?? 0, r: rand() }));
  keyed.sort((a, b) => a.last - b.last || a.r - b.r);
  return keyed.map((k) => k.t);
}

/** Verteilt Aufgaben so, dass aufeinanderfolgende Aufgaben möglichst aus verschiedenen Kursen stammen. */
export function interleave(items: SessionItem[], rand: () => number = Math.random): SessionItem[] {
  const groups = new Map<number, SessionItem[]>();
  for (const it of shuffle(items, rand)) {
    const k = getTask(it.taskId)?.kurs ?? 0;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }
  const out: SessionItem[] = [];
  let lastKurs = -1;
  while (out.length < items.length) {
    const candidates = [...groups.entries()].filter(([, l]) => l.length).sort((a, b) => b[1].length - a[1].length);
    const pick = candidates.find(([k]) => k !== lastKurs) ?? candidates[0];
    out.push(pick[1].shift()!);
    lastKurs = pick[0];
  }
  return out;
}

export function singleErrorTask(t: Task): boolean {
  return (t.typ === 'fehler' || t.typ === 'fehlertyp') && parseFehler(t.text).fehler.filter((e) => e.fehlertyp !== 'frei').length === 1;
}

/** Fehlertyp der einzigen Fehlerstelle einer Aufgabe. */
export function singleErrorType(t: Task): string {
  if (t.typ !== 'fehler' && t.typ !== 'fehlertyp') return t.fehlertyp;
  const e = parseFehler(t.text).fehler.filter((x) => x.fehlertyp !== 'frei')[0];
  return e?.fehlertyp ?? t.fehlertyp;
}

/** Vier Fehlertypen zur Auswahl: der richtige, einer aus demselben Bereich, zwei aus anderen. */
export function fehlertypOptionen(t: Task): string[] {
  const richtig = singleErrorType(t);
  if (t.typ === 'fehlertyp' && t.optionen?.length) return t.optionen.includes(richtig) ? t.optionen : [richtig, ...t.optionen].slice(0, 4);
  const rand = rng(`opt:${t.id}`);
  const ft = fehlertyp(richtig);
  const same = shuffle(FEHLERTYPEN.filter((x) => x.bereich === ft?.bereich && x.id !== richtig), rand);
  const other = shuffle(FEHLERTYPEN.filter((x) => x.bereich !== ft?.bereich), rand);
  const picks = [richtig, ...(same.length ? [same[0].id] : []), ...other.map((x) => x.id)].slice(0, 4);
  return shuffle(picks, rand);
}

// ---------- Lektion ----------

export function buildLessonPhase(lesson: Lesson, phase: 'gefuehrt' | 'frei' | 'test', data: AppData, seed: string): SessionItem[] {
  const ablauf = lessonAblauf(lesson);
  const rand = rng(seed);
  const rec = recencyMap(data);
  const all = lessonTasks(lesson.id);
  const verified = all.filter((t) => t.geprueft !== false);
  const kontext: Kontext = phase;
  if (phase === 'gefuehrt') {
    const sorted = byRecency(verified, rec, rand).sort((a, b) => a.stufe - b.stufe);
    const probe = sorted.filter((t) => t.typ === 'probe');
    const rest = sorted.filter((t) => t.typ !== 'probe');
    const n = ablauf.gefuehrt;
    const picks = [...probe.slice(0, Math.min(2, probe.length)), ...rest].slice(0, n);
    // Probe zuerst, dann nach Schwierigkeit
    picks.sort((a, b) => (a.typ === 'probe' ? -1 : 0) - (b.typ === 'probe' ? -1 : 0) || a.stufe - b.stufe);
    return picks.map((t) => ({ taskId: t.id, kontext }));
  }
  if (phase === 'frei') {
    const ordered = byRecency(all, rec, rand);
    // Typen mischen: reihum aus jedem Übungstyp
    const byTyp = new Map<string, Task[]>();
    for (const t of ordered) {
      if (!byTyp.has(t.typ)) byTyp.set(t.typ, []);
      byTyp.get(t.typ)!.push(t);
    }
    const out: Task[] = [];
    const lists = [...byTyp.values()];
    while (out.length < ablauf.frei && lists.some((l) => l.length)) {
      for (const l of lists) {
        const t = l.shift();
        if (t && out.length < ablauf.frei) out.push(t);
      }
    }
    return shuffle(out, rand).map((t) => ({ taskId: t.id, kontext }));
  }
  const ordered = byRecency(verified, rec, rand);
  const n = Math.min(ablauf.test, ordered.length);
  const picked = ordered.slice(0, n).sort((a, b) => a.stufe - b.stufe);
  return picked.map((t) => ({ taskId: t.id, kontext }));
}

// ---------- Tägliche Wiederholung ----------

export interface ReviewPlan {
  items: SessionItem[];
  faellig: number;
}

export function dueCount(data: AppData, today: string): number {
  return Object.values(data.reviews).filter((s) => isDue(s, today) && (s.art === 'fehlertyp' || getTask(s.ref))).length;
}

function pickForType(typeId: string, used: Set<string>, rec: Map<string, number>, rand: () => number, data: AppData, allowHeavy: boolean): Task | undefined {
  const tasks = typeTasks(typeId).filter((t) => !used.has(t.id) && (allowHeavy || !HEAVY.has(t.typ)));
  if (!tasks.length) return undefined;
  // Bevorzugt Lektionen, die schon begonnen wurden
  const started = tasks.filter((t) => (data.lessons[t.lektion]?.stufe ?? 'neu') !== 'neu');
  const pool = started.length ? started : tasks;
  return byRecency(pool, rec, rand)[0];
}

export function buildReview(data: AppData, today: string, size: number, seed: string): ReviewPlan {
  const rand = rng(seed);
  const rec = recencyMap(data);
  const used = new Set<string>();
  const items: SessionItem[] = [];
  let heavy = 0;
  const add = (t: Task | undefined, kontext: Kontext = 'wiederholung', modus?: 'fehlertyp') => {
    if (!t || used.has(t.id)) return false;
    if (HEAVY.has(t.typ)) {
      if (heavy >= 1) return false;
      heavy++;
    }
    used.add(t.id);
    items.push({ taskId: t.id, kontext, ...(modus ? { modus } : {}) });
    return true;
  };

  const due = Object.values(data.reviews)
    .filter((s) => isDue(s, today))
    .sort((a, b) => (a.faellig < b.faellig ? -1 : a.faellig > b.faellig ? 1 : a.stufe - b.stufe));
  const dueN = Math.round(size * 0.6);
  const weakN = Math.round(size * 0.3);
  let faellig = 0;
  for (const s of due) {
    if (items.length >= dueN) break;
    if (s.art === 'aufgabe') {
      if (add(getTask(s.ref))) faellig++;
    } else if (add(pickForType(s.ref, used, rec, rand, data, false))) faellig++;
  }
  const dueTotal = due.length;

  // Schwächste Fehlertypen
  const weak = weakestTypes(data.attempts, data.errors, today, 5).map((w) => w.typ);
  const weakTarget = items.length + weakN + (dueN - items.length);
  let guard = 0;
  while (weak.length && items.length < weakTarget && guard++ < 200) {
    const typ = weak[guard % weak.length];
    add(pickForType(typ, used, rec, rand, data, false));
  }

  // Zufällig aus gemeisterten Lektionen, sonst aus sicheren oder begonnenen
  const byLevel = (lv: string[]) => Object.values(data.lessons).filter((l) => lv.includes(l.stufe)).map((l) => l.lektion);
  let pool = byLevel(['gemeistert']);
  if (!pool.length) pool = byLevel(['sicher']);
  if (!pool.length) pool = byLevel(['inArbeit']);
  if (!pool.length) pool = BANK.courses.flatMap((c) => c.lektionen.map((l) => l.id));
  const poolTasks = shuffle(
    pool.flatMap((l) => lessonTasks(l).filter((t) => !HEAVY.has(t.typ))),
    rand,
  );
  for (const t of poolTasks) {
    if (items.length >= size) break;
    add(t);
  }
  return { items: interleave(items, rand), faellig: Math.min(faellig, dueTotal) };
}

// ---------- Mischtraining, gezieltes Üben ----------

export function buildMixed(kurse: number[], size: number, nurFehlertyp: boolean, data: AppData, seed: string): SessionItem[] {
  const rand = rng(seed);
  const rec = recencyMap(data);
  let tasks = allTasks().filter((t) => kurse.includes(t.kurs) && !HEAVY.has(t.typ));
  if (nurFehlertyp) tasks = tasks.filter(singleErrorTask);
  const ordered = byRecency(tasks, rec, rand);
  // Aus jedem gewählten Kurs etwa gleich viele
  const perKurs = new Map<number, Task[]>();
  for (const t of ordered) {
    if (!perKurs.has(t.kurs)) perKurs.set(t.kurs, []);
    perKurs.get(t.kurs)!.push(t);
  }
  const out: SessionItem[] = [];
  const lists = [...perKurs.values()];
  while (out.length < size && lists.some((l) => l.length)) {
    for (const l of lists) {
      const t = l.shift();
      if (!t || out.length >= size) continue;
      const modus = nurFehlertyp || (singleErrorTask(t) && rand() < 0.4) ? ('fehlertyp' as const) : undefined;
      out.push({ taskId: t.id, kontext: 'misch', ...(modus ? { modus } : {}) });
    }
  }
  return interleave(out, rand);
}

export function buildTargeted(types: string[], size: number, data: AppData, seed: string, kontext: Kontext = 'gezielt'): SessionItem[] {
  const rand = rng(seed);
  const rec = recencyMap(data);
  const used = new Set<string>();
  const out: SessionItem[] = [];
  let guard = 0;
  while (out.length < size && guard++ < size * 6) {
    const typ = types[guard % types.length];
    const t = pickForType(typ, used, rec, rand, data, false);
    if (!t) continue;
    used.add(t.id);
    out.push({ taskId: t.id, kontext });
  }
  return interleave(out, rand);
}

/** Vor der Klausur: Aufgaben aus den häufigsten eigenen Fehlertypen; die Sitzung endet nach 15 Minuten. */
export function buildKlausur(data: AppData, today: string, seed: string): { items: SessionItem[]; typen: string[] } {
  let typen = frequentTypes(data.attempts, data.errors, today, 90, 5).map((x) => x.typ);
  if (!typen.length) typen = ['k-nebensatz', 'k-infinitiv', 'r-dasdass', 'r-gross', 'kj-indikativ'];
  return { items: buildTargeted(typen, 60, data, seed, 'klausur'), typen };
}

// ---------- Einstufung und Kurstest ----------

export const EINSTUFUNG_VERTEILUNG: Record<number, number> = { 1: 6, 2: 5, 3: 5, 4: 3, 5: 5, 6: 4, 7: 4, 8: 4, 9: 4 };

export function buildPlacement(seed = 'einstufung'): SessionItem[] {
  const rand = rng(seed);
  const items: SessionItem[] = [];
  for (const [kursStr, n] of Object.entries(EINSTUFUNG_VERTEILUNG)) {
    const kurs = Number(kursStr);
    const course = BANK.courses.find((c) => c.id === kurs);
    if (!course) continue;
    const lessons = shuffle(course.lektionen, rand);
    const picks: Task[] = [];
    let round = 0;
    while (picks.length < n && round < 10) {
      for (const l of lessons) {
        if (picks.length >= n) break;
        const cands = shuffle(
          lessonTasks(l.id, false).filter((t) => t.stufe === 2 && !HEAVY.has(t.typ) && t.typ !== 'probe' && !picks.includes(t)),
          rand,
        );
        if (cands[round]) picks.push(cands[round]);
      }
      round++;
    }
    items.push(...picks.map((t) => ({ taskId: t.id, kontext: 'einstufung' as const })));
  }
  return interleave(items, rand);
}

export function buildCourseTest(kurs: number, data: AppData, seed: string): SessionItem[] {
  const rand = rng(seed);
  const rec = recencyMap(data);
  const course = BANK.courses.find((c) => c.id === kurs);
  if (!course) return [];
  const tasks = course.lektionen.flatMap((l) => lessonTasks(l.id, false));
  if (tasks.every((t) => HEAVY.has(t.typ))) {
    return byRecency(tasks, rec, rand)
      .slice(0, 2)
      .map((t) => ({ taskId: t.id, kontext: 'kurstest' as const }));
  }
  const perLesson = course.lektionen.map((l) => byRecency(lessonTasks(l.id, false).filter((t) => !HEAVY.has(t.typ)), rec, rand));
  const out: Task[] = [];
  while (out.length < 25 && perLesson.some((l) => l.length)) {
    for (const l of perLesson) {
      const t = l.shift();
      if (t && out.length < 25) out.push(t);
    }
  }
  return shuffle(out, rand).map((t) => ({ taskId: t.id, kontext: 'kurstest' as const }));
}

/** Fünf verwandte Aufgaben zu einem Fehlertyp für die Wiederholung (nach einem Klausurfehler). */
export function relatedTasks(typeId: string, data: AppData, exclude: string[] = [], n = 5): Task[] {
  const rec = recencyMap(data);
  const rand = rng(`rel:${typeId}:${Date.now()}`);
  const lessonId = fehlertyp(typeId)?.lektion;
  const tasks = typeTasks(typeId).filter((t) => !exclude.includes(t.id) && !HEAVY.has(t.typ) && t.geprueft !== false);
  const fromLesson = lessonId ? tasks.filter((t) => t.lektion === lessonId) : [];
  const others = tasks.filter((t) => t.lektion !== lessonId);
  return [...byRecency(fromLesson, rec, rand), ...byRecency(others, rec, rand)].slice(0, n);
}

export function lessonTitle(id: string): string {
  return getLesson(id)?.titel ?? id;
}
