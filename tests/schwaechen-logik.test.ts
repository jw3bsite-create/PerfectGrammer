import { describe, expect, it } from 'vitest';
import { addDays } from '../src/lib/dates';
import { BANK_AUFGABEN, aufgabe } from '../src/schwaechen/daten';
import {
  ampel,
  fehlerJeKat,
  gewicht,
  haeufigsteKats,
  kategorieAufgaben,
  katStand,
  kontrollAufgabe,
  mischAufgaben,
  nachFehler,
  nachKategorieSitzung,
  pruefungFaellig,
  wiederholungstaeter,
} from '../src/schwaechen/logik';
import { leererStand, type SchwState, type SSitzung, type SVersuch } from '../src/schwaechen/typen';

const T0 = '2026-10-12';
const NOW = Date.parse('2026-10-12T10:00:00');

describe('Stufen: gemeistert nach drei Prüfungen im Abstand von 1, 3 und 7 Tagen', () => {
  it('führt vom Training über drei Prüfungen zu „gemeistert“', () => {
    let st = katStand(leererStand(), 'S1');
    expect(ampel(st)).toBe('rot');
    let r = nachKategorieSitzung(st, 0.9, T0, NOW);
    st = r.stand;
    expect(st.stufe).toBe(1);
    expect(st.faellig).toBe(addDays(T0, 1));
    expect(ampel(st)).toBe('gelb');

    // vor dem Fälligkeitstag: nur Übung
    r = nachKategorieSitzung(st, 1, T0, NOW);
    expect(r.stand.stufe).toBe(1);

    let tag = addDays(T0, 1);
    expect(pruefungFaellig(st, tag)).toBe(true);
    st = nachKategorieSitzung(st, 0.95, tag, NOW).stand;
    expect(st.stufe).toBe(2);
    expect(st.faellig).toBe(addDays(tag, 3));

    tag = addDays(tag, 3);
    st = nachKategorieSitzung(st, 0.9, tag, NOW).stand;
    expect(st.stufe).toBe(3);
    expect(st.faellig).toBe(addDays(tag, 7));

    tag = addDays(tag, 7);
    r = nachKategorieSitzung(st, 1, tag, NOW);
    st = r.stand;
    expect(st.stufe).toBe(4);
    expect(ampel(st)).toBe('gruen');
    expect(r.meldung).toContain('gemeistert');
    expect(new Set(st.verlauf.filter((v) => v.art === 'pruefung').map((v) => v.tag)).size).toBe(3);
  });

  it('unter 90 Prozent: kein Aufstieg; durchgefallene Prüfung eine Stufe zurück', () => {
    let st = katStand(leererStand(), 'S2');
    st = nachKategorieSitzung(st, 0.89, T0, NOW).stand;
    expect(st.stufe).toBe(0);
    st = nachKategorieSitzung(st, 0.9, T0, NOW).stand;
    const tag = addDays(T0, 1);
    st = nachKategorieSitzung(st, 0.95, tag, NOW).stand; // Stufe 2
    const tag2 = addDays(tag, 3);
    st = nachKategorieSitzung(st, 0.7, tag2, NOW).stand;
    expect(st.stufe).toBe(1);
    expect(st.faellig).toBe(addDays(tag2, 1));
  });

  it('ein Fehler in einer gemeisterten Kategorie stuft eine Stufe zurück', () => {
    const st = { ...katStand(leererStand(), 'S3'), stufe: 4 as const };
    const n = nachFehler(st, T0, NOW);
    expect(n.stufe).toBe(3);
    expect(n.faellig).toBe(addDays(T0, 1));
    expect(nachFehler({ ...st, stufe: 2 }, T0, NOW).stufe).toBe(2);
  });
});

function versuch(kat: string, regel: string, richtig: boolean, tag = T0, taskId = `${kat}-01`): SVersuch {
  return { id: Math.random().toString(36), zeit: NOW, tag, taskId, kat, regel, antwortOk: richtig, regelOk: richtig, richtig, antwort: '', sitzung: 's' };
}

describe('Gewichtung, Wiederholungstäter, Checkliste', () => {
  it('Kategorien mit wiederholten Fehlern bekommen mehr Gewicht', () => {
    const s: SchwState = { ...leererStand(), versuche: [versuch('S4', 'S4.d2', false), versuch('S4', 'S4.d2', false), versuch('S5', 'S5.c1', true)] };
    expect(fehlerJeKat(s, T0).get('S4')).toBe(2);
    expect(gewicht(s, 'S4', T0)).toBeGreaterThan(gewicht(s, 'S5', T0));
  });

  it('Wiederholungstäter ab zwei Fehlern gegen dieselbe Regel, eingetragene Fehler zählen mit', () => {
    const s: SchwState = {
      ...leererStand(),
      versuche: [versuch('S2', 'S2.g1', false), versuch('S9', 'S9.r1', false)],
      eintraege: [{ id: 'e', zeit: NOW, tag: T0, falsch: 'etwas neues', richtig: 'etwas Neues', kat: 'S2', regel: 'S2.g1', taskIds: [] }],
    };
    const t = wiederholungstaeter(s);
    expect(t.map((x) => x.regel)).toEqual(['S2.g1']);
    expect(t[0].anzahl).toBe(2);
    expect(haeufigsteKats(s, T0, 3)[0]).toBe('S2');
    // Übersehene Stellen in Transfer-Absätzen zählen mit
    const mitTransfer: SchwState = { ...s, versuche: [...s.versuche, { ...versuch('T', '', false), regel: undefined, fehlerKats: ['S9'], fehlerRegeln: ['S9.r1'] }] };
    expect(wiederholungstaeter(mitTransfer).find((x) => x.regel === 'S9.r1')?.anzahl).toBe(2);
  });
});

describe('Aufgabenwahl', () => {
  it('Kategorie-Sitzung: zehn verschiedene Aufgaben der Kategorie, jede Form, höchstens vier je Form', () => {
    const ids = kategorieAufgaben(leererStand(), 'S1', T0, 'x');
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
    const typen = ids.map((id) => aufgabe(id, [])!.typ);
    for (const t of new Set(typen)) expect(typen.filter((x) => x === t).length).toBeLessThanOrEqual(4);
    expect(ids.every((id) => id.startsWith('S1-'))).toBe(true);
    for (const k of ['S1', 'S7', 'S12']) {
      for (const seed of ['a', 'b', 'c']) {
        const formen = new Set(kategorieAufgaben(leererStand(), k, T0, seed).map((id) => aufgabe(id, [])!.typ));
        const alle = new Set(BANK_AUFGABEN.filter((a) => a.kat === k).map((a) => a.typ));
        expect(formen, `${k}/${seed}: jede Übungsform`).toEqual(alle);
      }
    }
  });

  it('Kontrollaufgabe: gleiche Kategorie, bevorzugt gleiche Regel, nicht schon in der Sitzung', () => {
    const falsch = BANK_AUFGABEN.find((a) => a.id === 'S4-01')!;
    const sitz: SSitzung = { id: 's', art: 'kategorie', kat: 'S4', titel: '', items: [{ taskId: 'S4-01' }], index: 0, ergebnisse: [], gestartet: NOW };
    const k = kontrollAufgabe(leererStand(), sitz, falsch, T0)!;
    const a = aufgabe(k, [])!;
    expect(a.kat).toBe('S4');
    expect(a.regel).toBe(falsch.regel);
    expect(k).not.toBe('S4-01');
  });

  it('Gemischtes Training: fünfzehn Aufgaben aus vielen Kategorien, zwei Transfer-Absätze', () => {
    const s: SchwState = { ...leererStand(), versuche: [versuch('S7', 'S7.z4', false), versuch('S7', 'S7.z4', false), versuch('S7', 'S7.z4', false)] };
    const ids = mischAufgaben(s, T0, 'm');
    expect(ids).toHaveLength(15);
    expect(new Set(ids).size).toBe(15);
    expect(ids.filter((id) => id.startsWith('T-'))).toHaveLength(2);
    expect(new Set(ids.map((id) => id.split('-')[0])).size).toBeGreaterThanOrEqual(5);
  });
});
