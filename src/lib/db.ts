// IndexedDB-Speicher. Jede Änderung wird sofort geschrieben.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppData, Attempt, CourseState, ErrorEntry, LessonState, ReviewState, Task } from './types';
import { DEFAULT_SETTINGS } from './types';
import { leererStand } from '../schwaechen/typen';
import { leererZStand } from '../zusammenfassen/typen';

/** Version des Datenmodells. Bei Änderungen erhöhen und eine Migration ergänzen. */
export const DATA_VERSION = 3;

const DB_NAME = 'sprachrichtigkeit';
const DB_VERSION = 1;

interface Schema extends DBSchema {
  meta: { key: string; value: unknown };
  versuche: { key: string; value: Attempt; indexes: { zeit: number } };
  wiederholung: { key: string; value: ReviewState };
  fehlerbuch: { key: string; value: ErrorEntry };
  lektionen: { key: string; value: LessonState };
  kurse: { key: number; value: CourseState };
  eigeneAufgaben: { key: string; value: Task };
}

export type StoreName = 'versuche' | 'wiederholung' | 'fehlerbuch' | 'lektionen' | 'kurse' | 'eigeneAufgaben';

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function db(): Promise<IDBPDatabase<Schema>> {
  if (!dbPromise) {
    dbPromise = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(d, oldVersion) {
        if (oldVersion < 1) {
          d.createObjectStore('meta');
          const v = d.createObjectStore('versuche', { keyPath: 'id' });
          v.createIndex('zeit', 'zeit');
          d.createObjectStore('wiederholung', { keyPath: 'key' });
          d.createObjectStore('fehlerbuch', { keyPath: 'id' });
          d.createObjectStore('lektionen', { keyPath: 'lektion' });
          d.createObjectStore('kurse', { keyPath: 'kurs' });
          d.createObjectStore('eigeneAufgaben', { keyPath: 'id' });
        }
      },
      blocked() {
        console.warn('Datenbank wird von einem anderen Tab blockiert.');
      },
    });
  }
  return dbPromise;
}

export function emptyData(): AppData {
  return {
    settings: { ...DEFAULT_SETTINGS },
    attempts: [],
    reviews: {},
    errors: [],
    lessons: {},
    courses: {},
    customTasks: [],
    session: null,
    notices: [],
    schwaechen: leererStand(),
    zusammenfassen: leererZStand(),
  };
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Migrationen von Version n auf n + 1. */
const MIGRATIONS: Record<number, Migration> = {
  // 1 → 2: Modul „Meine Schwächen“ kommt hinzu.
  1: (raw) => ({ ...raw, schwaechen: raw.schwaechen ?? leererStand() }),
  // 2 → 3: Modul „Zusammenfassen“ kommt hinzu.
  2: (raw) => ({ ...raw, zusammenfassen: raw.zusammenfassen ?? leererZStand() }),
};

/** Bringt Rohdaten (aus der Datenbank oder einer Sicherung) auf den aktuellen Stand. */
export function migrate(raw: Record<string, unknown>, from: number): AppData {
  let cur = raw;
  for (let v = from; v < DATA_VERSION; v++) {
    const m = MIGRATIONS[v];
    if (m) cur = m(cur);
  }
  const base = emptyData();
  const d = cur as Partial<AppData>;
  return {
    settings: { ...base.settings, ...(d.settings ?? {}) },
    attempts: Array.isArray(d.attempts) ? d.attempts : [],
    reviews: d.reviews && typeof d.reviews === 'object' ? d.reviews : {},
    errors: Array.isArray(d.errors) ? d.errors : [],
    lessons: d.lessons && typeof d.lessons === 'object' ? d.lessons : {},
    courses: d.courses && typeof d.courses === 'object' ? d.courses : {},
    customTasks: Array.isArray(d.customTasks) ? d.customTasks : [],
    session: d.session ?? null,
    lastSession: d.lastSession,
    notices: Array.isArray(d.notices) ? d.notices : [],
    placementDone: d.placementDone,
    schwaechen: d.schwaechen && typeof d.schwaechen === 'object' ? { ...leererStand(), ...d.schwaechen } : leererStand(),
    zusammenfassen:
      d.zusammenfassen && typeof d.zusammenfassen === 'object'
        ? { ...leererZStand(), ...d.zusammenfassen, ki: { ...leererZStand().ki, ...(d.zusammenfassen.ki ?? {}) } }
        : leererZStand(),
  };
}

export async function loadAll(): Promise<AppData> {
  const d = await db();
  const tx = d.transaction(['meta', 'versuche', 'wiederholung', 'fehlerbuch', 'lektionen', 'kurse', 'eigeneAufgaben']);
  const [version, settings, session, lastSession, notices, placementDone, schwaechen, zusammenfassen, attempts, reviews, errors, lessons, courses, custom] = await Promise.all([
    tx.objectStore('meta').get('datenversion'),
    tx.objectStore('meta').get('settings'),
    tx.objectStore('meta').get('session'),
    tx.objectStore('meta').get('lastSession'),
    tx.objectStore('meta').get('notices'),
    tx.objectStore('meta').get('placementDone'),
    tx.objectStore('meta').get('schwaechen'),
    tx.objectStore('meta').get('zusammenfassen'),
    tx.objectStore('versuche').getAll(),
    tx.objectStore('wiederholung').getAll(),
    tx.objectStore('fehlerbuch').getAll(),
    tx.objectStore('lektionen').getAll(),
    tx.objectStore('kurse').getAll(),
    tx.objectStore('eigeneAufgaben').getAll(),
  ]);
  await tx.done;
  attempts.sort((a, b) => a.zeit - b.zeit);
  errors.sort((a, b) => a.zeit - b.zeit);
  const raw: Record<string, unknown> = {
    settings,
    session,
    lastSession,
    notices,
    placementDone,
    schwaechen,
    zusammenfassen,
    attempts,
    reviews: Object.fromEntries(reviews.map((r) => [r.key, r])),
    errors,
    lessons: Object.fromEntries(lessons.map((l) => [l.lektion, l])),
    courses: Object.fromEntries(courses.map((c) => [c.kurs, c])),
    customTasks: custom,
  };
  const from = typeof version === 'number' ? version : DATA_VERSION;
  const data = migrate(raw, from);
  if (from !== DATA_VERSION) await saveAll(data);
  else if (version === undefined) await d.put('meta', DATA_VERSION, 'datenversion');
  return data;
}

export async function putMeta(key: string, value: unknown) {
  const d = await db();
  if (value === undefined) await d.delete('meta', key);
  else await d.put('meta', value, key);
}

export async function put<S extends StoreName>(store: S, value: Schema[S]['value']) {
  const d = await db();
  await d.put(store, value as never);
}

export async function putMany<S extends StoreName>(store: S, values: Schema[S]['value'][]) {
  if (!values.length) return;
  const d = await db();
  const tx = d.transaction(store, 'readwrite');
  await Promise.all([...values.map((v) => tx.store.put(v as never)), tx.done]);
}

export async function remove<S extends StoreName>(store: S, key: Schema[S]['key']) {
  const d = await db();
  await d.delete(store, key as never);
}

export async function removeMany<S extends StoreName>(store: S, keys: Schema[S]['key'][]) {
  if (!keys.length) return;
  const d = await db();
  const tx = d.transaction(store, 'readwrite');
  await Promise.all([...keys.map((k) => tx.store.delete(k as never)), tx.done]);
}

/** Ersetzt den gesamten Bestand (Import, Zurücksetzen). */
export async function saveAll(data: AppData) {
  const d = await db();
  const names = ['meta', 'versuche', 'wiederholung', 'fehlerbuch', 'lektionen', 'kurse', 'eigeneAufgaben'] as const;
  const tx = d.transaction([...names], 'readwrite');
  await Promise.all(names.map((n) => tx.objectStore(n).clear()));
  const meta = tx.objectStore('meta');
  const ops: Promise<unknown>[] = [
    meta.put(DATA_VERSION, 'datenversion'),
    meta.put(data.settings, 'settings'),
    meta.put(data.notices, 'notices'),
    meta.put(data.schwaechen, 'schwaechen'),
    meta.put(data.zusammenfassen, 'zusammenfassen'),
  ];
  if (data.session) ops.push(meta.put(data.session, 'session'));
  if (data.lastSession) ops.push(meta.put(data.lastSession, 'lastSession'));
  if (data.placementDone) ops.push(meta.put(data.placementDone, 'placementDone'));
  for (const a of data.attempts) ops.push(tx.objectStore('versuche').put(a));
  for (const r of Object.values(data.reviews)) ops.push(tx.objectStore('wiederholung').put(r));
  for (const e of data.errors) ops.push(tx.objectStore('fehlerbuch').put(e));
  for (const l of Object.values(data.lessons)) ops.push(tx.objectStore('lektionen').put(l));
  for (const c of Object.values(data.courses)) ops.push(tx.objectStore('kurse').put(c));
  for (const t of data.customTasks) ops.push(tx.objectStore('eigeneAufgaben').put(t));
  await Promise.all([...ops, tx.done]);
}

// ---------- Sicherung ----------

export interface Backup {
  app: 'sprachrichtigkeit';
  datenversion: number;
  exportiert: string;
  daten: AppData;
}

export function toBackup(data: AppData): Backup {
  return { app: 'sprachrichtigkeit', datenversion: DATA_VERSION, exportiert: new Date().toISOString(), daten: data };
}

export function fromBackup(json: unknown): AppData {
  if (!json || typeof json !== 'object') throw new Error('Die Datei enthält keine gültige Sicherung.');
  const b = json as Partial<Backup>;
  if (b.app !== 'sprachrichtigkeit' || !b.daten) throw new Error('Die Datei ist keine Sicherung von „Sprachrichtigkeit“.');
  const v = typeof b.datenversion === 'number' ? b.datenversion : 1;
  if (v > DATA_VERSION) throw new Error('Die Sicherung stammt aus einer neueren Version der App. Aktualisiere die App und versuche es erneut.');
  return migrate(b.daten as unknown as Record<string, unknown>, v);
}

export async function requestPersistence(): Promise<boolean | undefined> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* nicht verfügbar */
  }
  return undefined;
}
