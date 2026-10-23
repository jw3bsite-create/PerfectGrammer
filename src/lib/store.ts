// Zentraler Zustand der App mit allen Aktionen. Jede Aktion schreibt sofort in IndexedDB.

import { useSyncExternalStore } from 'react';
import { getLesson, getTask, setCustomTasks, taskPrompt } from './content';
import { dayKey } from './dates';
import * as DB from './db';
import { lcsAlign } from './diff';
import { fehlertyp } from './fehlertypen';
import { afterAttempt, afterTest, emptyLessonState, kurstestBestanden, testBestanden } from './mastery';
import { normalizeSpaces } from './normalize';
import { uid } from './random';
import { relatedTasks } from './sessions';
import { nextState, scheduleNow, taskKey, typeKey } from './srs';
import type {
  AppData,
  Attempt,
  CourseState,
  ErrorEntry,
  FehlerTask,
  Kontext,
  LessonState,
  Notice,
  ReviewState,
  Session,
  Settings,
  Task,
  Teilergebnis,
  WortTask,
} from './types';

type Listener = () => void;

let state: AppData = DB.emptyData();
let ready = false;
let loadError: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function set(next: AppData) {
  state = next;
  setCustomTasks(state.customTasks);
  emit();
}

/** Modul „Meine Schwächen“: Zustand ändern und sofort speichern. */
export async function updateSchwaechen(fn: (s: AppData['schwaechen']) => AppData['schwaechen']) {
  const next = fn(state.schwaechen);
  set({ ...state, schwaechen: next });
  await DB.putMeta('schwaechen', next);
}

/** Modul „Zusammenfassen“: Zustand ändern und sofort speichern. */
export async function updateZusammenfassen(fn: (s: AppData['zusammenfassen']) => AppData['zusammenfassen']) {
  const next = fn(state.zusammenfassen);
  set({ ...state, zusammenfassen: next });
  await DB.putMeta('zusammenfassen', next);
}

/**
 * Stand neu aus der Datenbank lesen. Hauptfenster und Schwächen-Fenster teilen sich die Datenbank;
 * beim Wechsel ins andere Fenster wird dessen Stand übernommen.
 */
export async function reloadFromDb() {
  if (!ready || loadError) return;
  try {
    set(await DB.loadAll());
  } catch {
    /* bleibt beim bisherigen Stand */
  }
}

export function getState(): AppData {
  return state;
}

export function isReady(): boolean {
  return ready;
}

export function getLoadError(): string | null {
  return loadError;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

let readyVersion = 0;
function snapshot() {
  return state;
}

export function useApp(): AppData {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function useReady(): { ready: boolean; error: string | null; v: number } {
  useSyncExternalStore(subscribe, () => readyVersion, () => readyVersion);
  return { ready, error: loadError, v: readyVersion };
}

export async function init(): Promise<void> {
  try {
    const data = await DB.loadAll();
    ready = true;
    readyVersion++;
    set(data);
    void DB.requestPersistence();
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
    ready = true;
    readyVersion++;
    emit();
  }
}

/** Für Tests: Zustand direkt setzen, ohne Datenbank. */
export function _setStateForTests(d: AppData) {
  ready = true;
  set(d);
}

// ---------- Einstellungen ----------

export async function updateSettings(patch: Partial<Settings>) {
  const settings = { ...state.settings, ...patch };
  set({ ...state, settings });
  await DB.putMeta('settings', settings);
}

// ---------- Lektionen ----------

function lessonState(id: string): LessonState {
  return state.lessons[id] ?? emptyLessonState(id);
}

export async function markRuleRead(lessonId: string) {
  const prev = lessonState(lessonId);
  const now = Date.now();
  const next: LessonState = {
    ...prev,
    regelGelesen: prev.regelGelesen ?? now,
    stufe: prev.stufe === 'neu' ? 'inArbeit' : prev.stufe,
    begonnen: prev.begonnen ?? now,
    phase: prev.phase ?? 'regel',
    zuletzt: now,
  };
  set({ ...state, lessons: { ...state.lessons, [lessonId]: next } });
  await DB.put('lektionen', next);
}

// ---------- Sitzungen ----------

export async function startSession(s: Session) {
  set({ ...state, session: s });
  await DB.putMeta('session', s);
}

export async function updateSession(s: Session) {
  set({ ...state, session: s });
  await DB.putMeta('session', s);
}

export async function abandonSession() {
  const s = state.session;
  set({ ...state, session: null });
  await DB.putMeta('session', undefined);
  if (s && s.results.length) await finishSessionBookkeeping(s, false);
}

export interface SessionSummary {
  richtig: number;
  gesamt: number;
  bestanden?: boolean;
  levelVorher?: string;
  levelNachher?: string;
}

/** Abschluss einer Sitzung: Lektionstest, Kurstest und Einstufung auswerten. */
export async function finishSession(): Promise<SessionSummary | null> {
  const s = state.session;
  if (!s) return null;
  const summary = await finishSessionBookkeeping(s, true);
  set({ ...state, session: null });
  await DB.putMeta('session', undefined);
  return summary;
}

function scoreOf(s: Session, teileWertung: boolean): { richtig: number; gesamt: number } {
  if (teileWertung) {
    let r = 0;
    let g = 0;
    for (const res of s.results) {
      if (res.teile && res.teile.length) {
        g += res.teile.length;
        r += res.teile.filter((t) => t.richtig).length;
      } else {
        g++;
        if (res.richtig) r++;
      }
    }
    return { richtig: r, gesamt: g };
  }
  return { richtig: s.results.filter((r) => r.richtig).length, gesamt: s.results.length };
}

async function finishSessionBookkeeping(s: Session, complete: boolean): Promise<SessionSummary> {
  const now = Date.now();
  const lessonId = s.lektion;
  const lesson = lessonId ? getLesson(lessonId) : undefined;
  const teile = lesson?.ablauf?.wertung === 'teile';
  const score = scoreOf(s, teile && s.art === 'lektion');
  const summary: SessionSummary = { ...score };
  const writes: (() => Promise<unknown>)[] = [];
  let next: AppData = { ...state, lastSession: { art: s.art, lektion: s.lektion, kurs: s.kurs, zeit: now, titel: s.titel, phase: s.phase } };
  if (s.art === 'lektion' && lessonId && complete) {
    const prev = lessonState(lessonId);
    summary.levelVorher = prev.stufe;
    let ls: LessonState;
    if (s.phase === 'test') {
      const bestanden = testBestanden(score.richtig, score.gesamt, teile ? 'teile' : 'aufgaben');
      summary.bestanden = bestanden;
      ls = afterTest(prev, { zeit: now, richtig: score.richtig, gesamt: score.gesamt, bestanden }, state.attempts.filter((a) => a.lektion === lessonId));
    } else {
      ls = { ...prev, phase: s.phase, zuletzt: now };
    }
    summary.levelNachher = ls.stufe;
    next = { ...next, lessons: { ...next.lessons, [lessonId]: ls } };
    writes.push(() => DB.put('lektionen', ls));
  }
  if (s.art === 'kurstest' && s.kurs && complete) {
    const cs: CourseState = state.courses[s.kurs] ?? { kurs: s.kurs, kurstests: [] };
    const kursScore = scoreOf(s, s.kurs === 10);
    const bestanden = kurstestBestanden(kursScore.richtig, kursScore.gesamt);
    summary.richtig = kursScore.richtig;
    summary.gesamt = kursScore.gesamt;
    summary.bestanden = bestanden;
    const ncs = { ...cs, kurstests: [...cs.kurstests, { zeit: now, ...kursScore, bestanden }] };
    next = { ...next, courses: { ...next.courses, [s.kurs]: ncs } };
    writes.push(() => DB.put('kurse', ncs));
  }
  if (s.art === 'einstufung' && complete) {
    const perKurs = new Map<number, { richtig: number; gesamt: number }>();
    for (const r of s.results) {
      const t = getTask(r.taskId);
      if (!t) continue;
      const cur = perKurs.get(t.kurs) ?? { richtig: 0, gesamt: 0 };
      cur.gesamt++;
      if (r.richtig) cur.richtig++;
      perKurs.set(t.kurs, cur);
    }
    const courses = { ...next.courses };
    const changed: CourseState[] = [];
    for (const [k, v] of perKurs) {
      const cs: CourseState = { ...(courses[k] ?? { kurs: k, kurstests: [] }), einstufung: { ...v, zeit: now } };
      courses[k] = cs;
      changed.push(cs);
    }
    next = { ...next, courses, placementDone: now };
    writes.push(() => DB.putMany('kurse', changed), () => DB.putMeta('placementDone', now));
  }
  set(next);
  writes.push(() => DB.putMeta('lastSession', next.lastSession));
  for (const w of writes) await w();
  return summary;
}

// ---------- Antworten ----------

export interface EntryDraft {
  original: string;
  korrektur: string;
  fehlertyp: string;
  begruendung?: string;
}

export interface RecordInput {
  task: Task;
  kontext: Kontext;
  sitzung: string;
  antwort: string;
  loesung: string;
  richtig: boolean;
  teile?: Teilergebnis[];
  /** Einträge für das Fehlerbuch bei mehrteiligen Aufgaben; sonst ein Eintrag mit dem Fehlertyp der Aufgabe. */
  eintraege?: EntryDraft[];
  /** Fehlertyp, der in der Wiederholung zählt (z. B. Typ der einzigen Fehlerstelle). */
  fehlertypOverride?: string;
}

interface Undo {
  attemptId: string;
  reviews: { key: string; prev: ReviewState | undefined }[];
  lesson: LessonState | undefined;
  errorIds: string[];
  noticeIds: string[];
}

let lastUndo: Undo | null = null;

function sourceLabel(kontext: Kontext, lektion: string): string {
  const k: Record<Kontext, string> = {
    gefuehrt: 'Geführte Übung',
    frei: 'Freie Übung',
    test: 'Lektionstest',
    wiederholung: 'Wiederholung',
    misch: 'Mischtraining',
    gezielt: 'Gezielt üben',
    klausur: 'Vor der Klausur',
    einstufung: 'Einstufungstest',
    kurstest: 'Kurstest',
    korrektur: 'Korrekturlesen',
  };
  return `App · ${k[kontext]} · Lektion ${lektion}`;
}

export async function recordAttempt(input: RecordInput): Promise<{ attempt: Attempt; notice?: string }> {
  const now = Date.now();
  const today = dayKey(now);
  const t = input.task;
  const mainType = input.fehlertypOverride ?? t.fehlertyp;
  const attempt: Attempt = {
    id: uid(),
    taskId: t.id,
    kurs: t.kurs,
    lektion: t.lektion,
    fehlertyp: mainType,
    typ: t.typ,
    zeit: now,
    tag: today,
    antwort: input.antwort,
    loesung: input.loesung,
    richtig: input.richtig,
    sitzung: input.sitzung,
    kontext: input.kontext,
    ...(input.teile && input.teile.length ? { teile: input.teile } : {}),
  };
  const undo: Undo = { attemptId: attempt.id, reviews: [], lesson: state.lessons[t.lektion], errorIds: [], noticeIds: [] };

  // Wiederholungsstand: Aufgabe und Fehlertyp(en)
  const reviews = { ...state.reviews };
  const changedReviews: ReviewState[] = [];
  const apply = (key: string, art: ReviewState['art'], ref: string, ok: boolean) => {
    const prev = reviews[key];
    const ns = nextState(prev, key, art, ref, ok, today, now);
    if (ns) {
      undo.reviews.push({ key, prev });
      reviews[key] = ns;
      changedReviews.push(ns);
    }
  };
  apply(taskKey(t.id), 'aufgabe', t.id, input.richtig);
  const typeResults = new Map<string, boolean>();
  if (attempt.teile) {
    for (const p of attempt.teile) {
      if (!p.fehlertyp) continue;
      typeResults.set(p.fehlertyp, (typeResults.get(p.fehlertyp) ?? true) && p.richtig);
    }
  } else {
    typeResults.set(mainType, input.richtig);
  }
  for (const [typ, ok] of typeResults) apply(typeKey(typ), 'fehlertyp', typ, ok);

  // Beherrschungsgrad
  const attempts = [...state.attempts, attempt];
  const lesson = getLesson(t.lektion);
  let lessons = state.lessons;
  let notice: string | undefined;
  let notices = state.notices;
  if (lesson) {
    const prevLs = state.lessons[t.lektion] ?? emptyLessonState(t.lektion);
    const upd = afterAttempt(
      prevLs,
      attempts.filter((a) => a.lektion === t.lektion),
      attempt,
      lesson.titel,
    );
    lessons = { ...state.lessons, [t.lektion]: upd.state };
    if (upd.notice) {
      notice = upd.notice;
      const n: Notice = { id: uid(), zeit: now, text: upd.notice, lektion: t.lektion };
      notices = [...notices, n];
      undo.noticeIds.push(n.id);
    }
  }

  // Fehlerbuch
  const newErrors: ErrorEntry[] = [];
  if (!input.richtig) {
    const drafts: EntryDraft[] = input.eintraege?.length
      ? input.eintraege
      : [{ original: input.antwort, korrektur: input.loesung, fehlertyp: mainType, begruendung: t.begruendung }];
    for (const d of drafts) {
      const ft = fehlertyp(d.fehlertyp);
      const entry: ErrorEntry = {
        id: uid(),
        zeit: now,
        tag: today,
        herkunft: 'app',
        quelle: sourceLabel(input.kontext, t.lektion),
        original: d.original,
        korrektur: d.korrektur,
        fehlertyp: d.fehlertyp,
        kurs: t.kurs,
        lektion: ft && d.fehlertyp !== mainType ? ft.lektion : t.lektion,
        taskId: t.id,
        attemptId: attempt.id,
        aufgabe: taskPrompt(t),
        begruendung: d.begruendung,
      };
      newErrors.push(entry);
      undo.errorIds.push(entry.id);
    }
  }

  set({ ...state, attempts, reviews, lessons, errors: newErrors.length ? [...state.errors, ...newErrors] : state.errors, notices });
  lastUndo = undo;
  await DB.put('versuche', attempt);
  await DB.putMany('wiederholung', changedReviews);
  if (lessons[t.lektion]) await DB.put('lektionen', lessons[t.lektion]);
  await DB.putMany('fehlerbuch', newErrors);
  if (notices !== state.notices || undo.noticeIds.length) await DB.putMeta('notices', notices);
  return { attempt, notice };
}

/** „Als richtig werten“: Die letzte Antwort war eine gültige Variante, die die Prüfung nicht kannte. */
export async function overrideLastAttempt(attemptId: string): Promise<boolean> {
  const u = lastUndo;
  if (!u || u.attemptId !== attemptId) return false;
  const idx = state.attempts.findIndex((a) => a.id === attemptId);
  if (idx < 0) return false;
  const a: Attempt = { ...state.attempts[idx], richtig: true, uebersteuert: true };
  const attempts = state.attempts.slice();
  attempts[idx] = a;
  const reviews = { ...state.reviews };
  const restored: ReviewState[] = [];
  const removedKeys: string[] = [];
  for (const r of u.reviews.slice().reverse()) {
    if (r.prev) {
      reviews[r.key] = r.prev;
      restored.push(r.prev);
    } else {
      delete reviews[r.key];
      removedKeys.push(r.key);
    }
  }
  const errors = state.errors.filter((e) => !u.errorIds.includes(e.id));
  const notices = state.notices.filter((n) => !u.noticeIds.includes(n.id));
  let lessons = state.lessons;
  const lesson = getLesson(a.lektion);
  if (lesson) {
    const base = u.lesson ?? emptyLessonState(a.lektion);
    const upd = afterAttempt(base, attempts.filter((x) => x.lektion === a.lektion), a, lesson.titel);
    lessons = { ...state.lessons, [a.lektion]: upd.state };
  }
  // In der laufenden Sitzung ebenfalls korrigieren
  let session = state.session;
  if (session) {
    session = { ...session, results: session.results.map((r) => (r.attemptId === attemptId ? { ...r, richtig: true, teile: undefined } : r)) };
  }
  set({ ...state, attempts, reviews, errors, notices, lessons, session });
  lastUndo = null;
  await DB.put('versuche', a);
  await DB.putMany('wiederholung', restored);
  await DB.removeMany('wiederholung', removedKeys);
  await DB.removeMany('fehlerbuch', u.errorIds);
  await DB.putMeta('notices', notices);
  if (lessons[a.lektion]) await DB.put('lektionen', lessons[a.lektion]);
  if (session) await DB.putMeta('session', session);
  return true;
}

export async function dismissNotice(id: string) {
  const notices = state.notices.map((n) => (n.id === id ? { ...n, gelesen: true } : n));
  set({ ...state, notices });
  await DB.putMeta('notices', notices);
}

// ---------- Fehlerbuch: Fehler aus echten Arbeiten ----------

export interface ManualInput {
  tag: string;
  quelle: string;
  original: string;
  korrektur: string;
  fehlertyp: string;
  notiz?: string;
}

/** Baut aus falscher und richtiger Fassung eine Aufgabe in Fehler-Notation (wortweise). */
export function buildFehlerMarkup(original: string, korrektur: string, typ: string): string {
  const a = normalizeSpaces(original).split(' ');
  const b = normalizeSpaces(korrektur).split(' ');
  const match = lcsAlign(a, b);
  const out: string[] = [];
  let j = 0;
  let i = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && match[i] === j) {
      out.push(a[i]);
      i++;
      j++;
      continue;
    }
    const ra: string[] = [];
    while (i < a.length && match[i] < 0) ra.push(a[i++]);
    const target = i < a.length ? match[i] : b.length;
    const rb = b.slice(j, target);
    j = target;
    if (!ra.length && !rb.length) continue;
    // Reine Einfügung oder Löschung an ein Nachbarwort binden, damit die Stelle antippbar bleibt.
    if (!ra.length) {
      const prev = out.pop();
      if (prev !== undefined) out.push(`[[${prev}=>${[prev, ...rb].join(' ')}|${typ}]]`);
      else if (i < a.length) {
        out.push(`[[${a[i]}=>${[...rb, b[j]].join(' ')}|${typ}]]`);
        i++;
        j++;
      }
      continue;
    }
    out.push(`[[${ra.join(' ')}=>${rb.join(' ')}|${typ}]]`);
  }
  return out.join(' ').replace(/=> \|/g, '=>|');
}

function manualTask(id: string, input: ManualInput): FehlerTask {
  const ft = fehlertyp(input.fehlertyp);
  const lektion = ft?.lektion ?? '1.1';
  return {
    id,
    kurs: Number(lektion.split('.')[0]),
    lektion,
    typ: 'fehler',
    fehlertyp: input.fehlertyp,
    stufe: 2,
    text: buildFehlerMarkup(input.original, input.korrektur, input.fehlertyp),
    begruendung: `Eigener Fehler aus „${input.quelle.trim() || 'einer Arbeit'}“. Richtig ist: ${normalizeSpaces(input.korrektur)}`,
    geprueft: false,
    herkunft: 'fehlerbuch',
  };
}

export async function addManualError(input: ManualInput): Promise<{ entry: ErrorEntry; related: number }> {
  const now = Date.now();
  const today = dayKey(now);
  const ft = fehlertyp(input.fehlertyp);
  const lektion = ft?.lektion ?? '1.1';
  const task = manualTask(`eigen-${uid()}`, input);
  const entry: ErrorEntry = {
    id: uid(),
    zeit: now,
    tag: input.tag,
    herkunft: 'arbeit',
    quelle: input.quelle.trim(),
    original: normalizeSpaces(input.original),
    korrektur: normalizeSpaces(input.korrektur),
    fehlertyp: input.fehlertyp,
    kurs: Number(lektion.split('.')[0]),
    lektion,
    taskId: task.id,
    notiz: input.notiz?.trim() || undefined,
  };
  const customTasks = [...state.customTasks, task];
  setCustomTasks(customTasks);
  const related = relatedTasks(input.fehlertyp, state, [task.id]);
  const reviews = { ...state.reviews };
  const changed: ReviewState[] = [];
  const schedule = (key: string, art: ReviewState['art'], ref: string) => {
    const ns = scheduleNow(reviews[key], key, art, ref, today, now);
    reviews[key] = ns;
    changed.push(ns);
  };
  schedule(taskKey(task.id), 'aufgabe', task.id);
  schedule(typeKey(input.fehlertyp), 'fehlertyp', input.fehlertyp);
  for (const r of related) schedule(taskKey(r.id), 'aufgabe', r.id);
  set({ ...state, customTasks, errors: [...state.errors, entry], reviews });
  await DB.put('eigeneAufgaben', task);
  await DB.put('fehlerbuch', entry);
  await DB.putMany('wiederholung', changed);
  return { entry, related: related.length };
}

export async function updateError(id: string, patch: Partial<ErrorEntry>) {
  const idx = state.errors.findIndex((e) => e.id === id);
  if (idx < 0) return;
  const prev = state.errors[idx];
  let entry: ErrorEntry = { ...prev, ...patch, geaendert: Date.now() };
  if (patch.fehlertyp && patch.fehlertyp !== prev.fehlertyp) {
    const ft = fehlertyp(patch.fehlertyp);
    if (ft) entry = { ...entry, lektion: ft.lektion, kurs: Number(ft.lektion.split('.')[0]) };
  }
  const errors = state.errors.slice();
  errors[idx] = entry;
  let customTasks = state.customTasks;
  if (entry.herkunft === 'arbeit' && entry.taskId) {
    const tIdx = customTasks.findIndex((t) => t.id === entry.taskId);
    if (tIdx >= 0) {
      const task = manualTask(entry.taskId, { tag: entry.tag, quelle: entry.quelle, original: entry.original, korrektur: entry.korrektur, fehlertyp: entry.fehlertyp });
      customTasks = customTasks.slice();
      customTasks[tIdx] = task;
      await DB.put('eigeneAufgaben', task);
    }
  }
  set({ ...state, errors, customTasks });
  await DB.put('fehlerbuch', entry);
}

export async function deleteError(id: string) {
  const entry = state.errors.find((e) => e.id === id);
  if (!entry) return;
  const errors = state.errors.filter((e) => e.id !== id);
  let customTasks = state.customTasks;
  const reviews = { ...state.reviews };
  if (entry.herkunft === 'arbeit' && entry.taskId) {
    customTasks = customTasks.filter((t) => t.id !== entry.taskId);
    delete reviews[taskKey(entry.taskId)];
    await DB.remove('eigeneAufgaben', entry.taskId);
    await DB.remove('wiederholung', taskKey(entry.taskId));
  }
  set({ ...state, errors, customTasks, reviews });
  await DB.remove('fehlerbuch', id);
}

// ---------- Eigene Wortliste und eigene Aufgaben ----------

export async function addCustomWord(wort: string, umschreibung: string): Promise<WortTask> {
  const task: WortTask = {
    id: `wort-${uid()}`,
    kurs: 7,
    lektion: '7.5',
    typ: 'wort',
    fehlertyp: 'r-fremdwort',
    stufe: 2,
    wort: normalizeSpaces(wort),
    umschreibung: normalizeSpaces(umschreibung) || 'Wort aus deiner eigenen Liste',
    begruendung: `Wort aus deiner eigenen Liste. Höre auf die Vokallänge und tippe „${normalizeSpaces(wort)}“ Buchstabe für Buchstabe.`,
    geprueft: false,
    herkunft: 'wortliste',
  };
  const customTasks = [...state.customTasks, task];
  set({ ...state, customTasks });
  await DB.put('eigeneAufgaben', task);
  return task;
}

export async function deleteCustomTask(id: string) {
  const customTasks = state.customTasks.filter((t) => t.id !== id);
  const reviews = { ...state.reviews };
  delete reviews[taskKey(id)];
  set({ ...state, customTasks, reviews });
  await DB.remove('eigeneAufgaben', id);
  await DB.remove('wiederholung', taskKey(id));
}

// ---------- Sicherung ----------

export function exportJson(): string {
  return JSON.stringify(DB.toBackup(state), null, 1);
}

export async function importJson(text: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }
  const data = DB.fromBackup(parsed);
  await DB.saveAll(data);
  set(data);
}

export async function resetAll() {
  const data = DB.emptyData();
  data.settings = { ...data.settings, onboardingErledigt: true, darstellung: state.settings.darstellung };
  await DB.saveAll(data);
  set(data);
}
