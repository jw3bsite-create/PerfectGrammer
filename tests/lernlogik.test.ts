import { describe, expect, it } from 'vitest';
import { addDays } from '../src/lib/dates';
import { afterAttempt, afterTest, emptyLessonState, kurstestBestanden, meetsGemeistert, testBestanden, units } from '../src/lib/mastery';
import { INTERVALLE, nextState, scheduleNow } from '../src/lib/srs';
import { entryStatus, typeEvents } from '../src/lib/errorbook';
import type { Attempt, ErrorEntry, Kontext, LessonState } from '../src/lib/types';

const DAY0 = '2026-10-01';
const T0 = Date.parse('2026-10-01T08:00:00Z');
const HOUR = 3600_000;

let n = 0;
function attempt(richtig: boolean, tagOffset: number, kontext: Kontext = 'frei', extra: Partial<Attempt> = {}): Attempt {
  n++;
  return {
    id: `v${n}`,
    taskId: `1.2-${n}`,
    kurs: 1,
    lektion: '1.2',
    fehlertyp: 'k-nebensatz',
    typ: 'komma',
    zeit: T0 + tagOffset * 24 * HOUR + n * 1000,
    tag: addDays(DAY0, tagOffset),
    antwort: '',
    loesung: '',
    richtig,
    sitzung: 's',
    kontext,
    ...extra,
  };
}

describe('Wiederholung in wachsenden Abständen', () => {
  it('eine falsche Antwort ist am nächsten Tag fällig', () => {
    const s = nextState(undefined, 'a:x', 'aufgabe', 'x', false, DAY0, T0)!;
    expect(s.stufe).toBe(1);
    expect(s.faellig).toBe(addDays(DAY0, 1));
  });

  it('richtige Antworten auf fällige Aufgaben rücken 1, 3, 7, 16, 35 Tage vor, danach erledigt', () => {
    let s = nextState(undefined, 'a:x', 'aufgabe', 'x', false, DAY0, T0)!;
    let today = s.faellig;
    const abstaende: number[] = [];
    for (let i = 0; i < 4; i++) {
      const next = nextState(s, 'a:x', 'aufgabe', 'x', true, today, T0)!;
      abstaende.push((Date.parse(next.faellig) - Date.parse(today)) / (24 * HOUR));
      s = next;
      today = s.faellig;
    }
    expect(abstaende).toEqual(INTERVALLE.slice(1));
    const done = nextState(s, 'a:x', 'aufgabe', 'x', true, today, T0)!;
    expect(done.erledigt).toBe(true);
  });

  it('eine richtige Antwort vor dem Fälligkeitstag ändert nichts, eine falsche setzt zurück', () => {
    const s = nextState(undefined, 'a:x', 'aufgabe', 'x', false, DAY0, T0)!;
    expect(nextState(s, 'a:x', 'aufgabe', 'x', true, DAY0, T0)).toBeUndefined();
    const later = { ...s, stufe: 4, faellig: addDays(DAY0, 10) };
    const back = nextState(later, 'a:x', 'aufgabe', 'x', false, addDays(DAY0, 10), T0)!;
    expect(back.stufe).toBe(1);
  });

  it('Klausurfehler sind sofort fällig', () => {
    expect(scheduleNow(undefined, 'a:x', 'aufgabe', 'x', DAY0, T0).faellig).toBe(DAY0);
  });
});

describe('Beherrschungsgrade', () => {
  const start: LessonState = emptyLessonState('1.2');

  it('die erste Antwort macht aus „Neu“ „In Arbeit“, die Einstufung nicht', () => {
    expect(afterAttempt(start, [], attempt(true, 0, 'gefuehrt'), 'Nebensätze').state.stufe).toBe('inArbeit');
    expect(afterAttempt(start, [], attempt(true, 0, 'einstufung'), 'Nebensätze').state.stufe).toBe('neu');
  });

  it('Lektionstest: neun von zehn heißt „Sicher“, acht nicht', () => {
    const ia = { ...start, stufe: 'inArbeit' as const };
    expect(testBestanden(9, 10)).toBe(true);
    expect(testBestanden(8, 10)).toBe(false);
    expect(afterTest(ia, { zeit: T0, richtig: 9, gesamt: 10, bestanden: true }, []).stufe).toBe('sicher');
    expect(afterTest(ia, { zeit: T0, richtig: 8, gesamt: 10, bestanden: false }, []).stufe).toBe('inArbeit');
  });

  it('„Gemeistert“: 19 der letzten 20 richtig an mindestens drei Tagen', () => {
    const drei = [...Array(20)].map((_, i) => attempt(i !== 5, i % 3)).sort((a, b) => a.zeit - b.zeit);
    expect(meetsGemeistert(drei.flatMap(units))).toBe(true);
    const zwei = [...Array(20)].map((_, i) => attempt(i !== 5, i % 2)).sort((a, b) => a.zeit - b.zeit);
    expect(meetsGemeistert(zwei.flatMap(units))).toBe(false);
    const achtzehn = [...Array(20)].map((_, i) => attempt(i > 1, i % 3)).sort((a, b) => a.zeit - b.zeit);
    expect(meetsGemeistert(achtzehn.flatMap(units))).toBe(false);
  });

  it('Rückstufung: unter 80 Prozent der letzten zehn in der Wiederholung', () => {
    const sicher: LessonState = { ...start, stufe: 'sicher', sicherSeit: T0 };
    const zwei = [...Array(10)].map((_, i) => attempt(i >= 2, 1, 'wiederholung'));
    expect(afterAttempt(sicher, zwei, zwei[9], 'Nebensätze').state.stufe).toBe('sicher');
    const drei = [...Array(10)].map((_, i) => attempt(i >= 3, 2, 'wiederholung'));
    const r = afterAttempt(sicher, drei, drei[9], 'Nebensätze');
    expect(r.state.stufe).toBe('inArbeit');
    expect(r.notice).toContain('7 von 10');
  });

  it('Fehler in Lektionsübungen stufen nicht zurück', () => {
    const sicher: LessonState = { ...start, stufe: 'sicher', sicherSeit: T0 };
    const frei = [...Array(10)].map((_, i) => attempt(i >= 5, 1, 'frei'));
    expect(afterAttempt(sicher, frei, frei[9], 'Nebensätze').state.stufe).toBe('sicher');
  });

  it('Kurstest bestanden ab 90 Prozent', () => {
    expect(kurstestBestanden(23, 25)).toBe(true);
    expect(kurstestBestanden(22, 25)).toBe(false);
  });

  it('Texte mit Prüfstellen zählen je Stelle', () => {
    const a = attempt(false, 0, 'frei', {
      teile: [
        { label: 'a', richtig: true, fehlertyp: 'kj-indikativ' },
        { label: 'b', richtig: false, fehlertyp: 'kj-ausweich' },
      ],
    } as Partial<Attempt>);
    expect(units(a).map((u) => u.richtig)).toEqual([true, false]);
    expect(testBestanden(9, 10, 'teile')).toBe(true);
    expect(testBestanden(17, 20, 'teile')).toBe(false);
  });
});

describe('Fehlerbuch: Status', () => {
  const entry: ErrorEntry = {
    id: 'e1',
    zeit: T0,
    tag: DAY0,
    herkunft: 'arbeit',
    quelle: 'Klausur 1',
    original: 'Er sagt das er kommt.',
    korrektur: 'Er sagt, dass er kommt.',
    fehlertyp: 'k-nebensatz',
    kurs: 1,
    lektion: '1.2',
  };

  it('fünfmal in Folge richtig an drei Tagen heißt behoben', () => {
    const list = [attempt(true, 1), attempt(true, 1), attempt(true, 2), attempt(true, 2), attempt(true, 3)];
    expect(entryStatus(entry, typeEvents(list, [entry])).status).toBe('behoben');
  });

  it('fünfmal richtig an nur zwei Tagen heißt in Übung', () => {
    const list = [attempt(true, 1), attempt(true, 1), attempt(true, 2), attempt(true, 2), attempt(true, 2)];
    expect(entryStatus(entry, typeEvents(list, [entry])).status).toBe('inUebung');
  });

  it('ein Fehler unterbricht die Serie', () => {
    const list = [attempt(true, 1), attempt(true, 1), attempt(false, 2), attempt(true, 2), attempt(true, 3), attempt(true, 3)];
    const s = entryStatus(entry, typeEvents(list, [entry]));
    expect(s.status).toBe('inUebung');
    expect(s.serie).toBe(3);
  });

  it('tritt der Typ erneut auf, öffnet sich der Eintrag wieder', () => {
    const list = [attempt(true, 1), attempt(true, 1), attempt(true, 2), attempt(true, 2), attempt(true, 3), attempt(false, 4)];
    const s = entryStatus(entry, typeEvents(list, [entry]));
    expect(s.status).toBe('offen');
    expect(s.wiedereroeffnet).toBe(true);
  });

  it('ohne Übung bleibt der Eintrag offen', () => {
    expect(entryStatus(entry, typeEvents([], [entry])).status).toBe('offen');
  });
});
