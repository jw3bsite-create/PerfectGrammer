// Abnahme auf Speicherebene: Fehlerbuch, Wiederholung am nächsten Tag, eigene Aufgaben, Sicherung.
import 'fake-indexeddb/auto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getTask } from '../src/lib/content';
import { buildReview } from '../src/lib/sessions';
import { addManualError, exportJson, getState, importJson, init, recordAttempt, resetAll } from '../src/lib/store';
import { isDue } from '../src/lib/srs';

const DAY1 = new Date('2026-10-12T09:00:00');
const DAY2 = new Date('2026-10-13T09:00:00');

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(DAY1);
  await init();
});

afterEach(() => {
  vi.setSystemTime(DAY1);
});

describe('Speicher und Lernlogik zusammen', () => {
  it('eine falsche Antwort steht sofort im Fehlerbuch und ist am nächsten Tag in der Wiederholung', async () => {
    await resetAll();
    const task = getTask('4.1-01')!;
    await recordAttempt({ task, kontext: 'frei', sitzung: 's1', antwort: 'das', loesung: 'dass', richtig: false });
    const st = getState();
    expect(st.errors).toHaveLength(1);
    expect(st.errors[0].fehlertyp).toBe('r-dasdass');
    expect(st.errors[0].herkunft).toBe('app');

    // am selben Tag noch nicht fällig
    const heute = buildReview(st, '2026-10-12', 15, 'a');
    expect(heute.items.some((i) => i.taskId === task.id)).toBe(false);

    // am nächsten Tag fällig und in der Sitzung
    vi.setSystemTime(DAY2);
    const due = Object.values(getState().reviews).filter((r) => isDue(r, '2026-10-13'));
    expect(due.map((r) => r.ref)).toEqual(expect.arrayContaining([task.id, 'r-dasdass']));
    const morgen = buildReview(getState(), '2026-10-13', 15, 'b');
    expect(morgen.items.some((i) => i.taskId === task.id)).toBe(true);
  });

  it('ein Klausurfehler erzeugt eine eigene Aufgabe und fünf verwandte, sofort fällig', async () => {
    await resetAll();
    const { entry, related } = await addManualError({
      tag: '2026-10-12',
      quelle: 'Deutschklausur 1',
      original: 'Er glaubt das sie kommt.',
      korrektur: 'Er glaubt, dass sie kommt.',
      fehlertyp: 'k-nebensatz',
      notiz: '',
    });
    expect(related).toBe(5);
    expect(entry.lektion).toBe('1.2');
    const st = getState();
    const own = st.customTasks.find((t) => t.id === entry.taskId)!;
    expect(own.typ).toBe('fehler');
    expect(own.geprueft).toBe(false);
    const due = Object.values(st.reviews).filter((r) => isDue(r, '2026-10-12'));
    expect(due.filter((r) => r.art === 'aufgabe')).toHaveLength(6);
    const plan = buildReview(st, '2026-10-12', 15, 'c');
    expect(plan.items.some((i) => i.taskId === own.id)).toBe(true);
  });

  it('Sicherung und Wiederherstellung ergeben denselben Stand', async () => {
    const before = getState();
    const json = exportJson();
    await resetAll();
    expect(getState().errors).toHaveLength(0);
    await importJson(json);
    const after = getState();
    expect(after.errors).toEqual(before.errors);
    expect(after.reviews).toEqual(before.reviews);
    expect(after.customTasks).toEqual(before.customTasks);
    expect(after.attempts).toEqual(before.attempts);
  });

  it('eine fremde Datei wird abgelehnt, der Stand bleibt', async () => {
    const n = getState().errors.length;
    await expect(importJson('{"app":"anders","daten":{}}')).rejects.toThrow(/keine Sicherung/);
    await expect(importJson('kein json')).rejects.toThrow(/kein gültiges JSON/);
    expect(getState().errors).toHaveLength(n);
  });
});
