// Automatische Prüfung der Aufgabenbank. Läuft mit „npm run check:content“.

import { describe, expect, it } from 'vitest';
import { BANK } from '../src/lib/content';
import { FEHLERTYPEN, fehlertyp } from '../src/lib/fehlertypen';
import { parseFehler, parseKomma } from '../src/lib/markup';
import { evalTask, evalTextwiedergabe, evalTyped, prepareTask, evalKomma } from '../src/lib/evaluate';
import type { Task } from '../src/lib/types';

const tasks = [...BANK.tasks.values()];

/** Zählt Sätze grob: Satzzeichen, gefolgt von Leerzeichen und Großbuchstaben; Abkürzungen ausgenommen. */
function sentences(s: string): number {
  const cleaned = s
    .replace(/\b(z|d|u|o|v|s|Z|D)\.\s?(B|h|a|Ä|ä|T|U|o|u)\./g, 'ABK')
    .replace(/\b(Z|S|V|Nr|bzw|ca|vgl|ggf|usw|etc|Jh|Dr|evtl)\./g, 'ABK')
    .replace(/\d+\./g, 'N')
    .replace(/„[^“]*“/g, 'ZITAT');
  const m = cleaned.match(/[.!?](\s+|$)/g);
  return m ? m.length : 1;
}

function allTexts(t: Task): string[] {
  const out = [t.begruendung];
  switch (t.typ) {
    case 'probe':
    case 'komma':
    case 'fehler':
    case 'fehlertyp':
    case 'korrektur':
      out.push(t.text);
      break;
    case 'eintippen':
      out.push(t.text, ...t.loesungen, t.hinweis ?? '');
      break;
    case 'entscheiden':
      out.push(t.text, ...t.optionen);
      break;
    case 'umformen':
      out.push(t.vorlage, ...t.loesungen);
      break;
    case 'wort':
      out.push(t.wort, t.umschreibung);
      break;
    case 'textwiedergabe':
      out.push(t.vorlage, t.muster, t.quelle);
      break;
  }
  return out;
}

describe('Kurse und Lektionen', () => {
  it('hat zehn Kurse mit Lektionen und Regelkarten', () => {
    expect(BANK.courses.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const c of BANK.courses) {
      expect(c.lektionen.length, `Kurs ${c.id}`).toBeGreaterThan(0);
      expect(c.probe.length).toBeGreaterThan(10);
      for (const l of c.lektionen) {
        expect(l.id.startsWith(`${c.id}.`), l.id).toBe(true);
        const k = l.regelkarte;
        expect(sentences(k.regel), `Regel ${l.id}: ${k.regel}`).toBeLessThanOrEqual(3);
        expect(k.beispiele.length, `Beispiele ${l.id}`).toBeGreaterThanOrEqual(2);
        expect(k.beispiele.length, `Beispiele ${l.id}`).toBeLessThanOrEqual(3);
        expect(k.probe.length).toBeGreaterThan(10);
        expect(k.falle.length).toBeGreaterThan(10);
      }
    }
  });

  it('erfüllt die Mindestzahl geprüfter Aufgaben je Lektion', () => {
    for (const c of BANK.courses) {
      for (const l of c.lektionen) {
        const n = (BANK.byLesson.get(l.id) ?? []).filter((t) => t.geprueft !== false).length;
        let min = c.id === 1 || c.id === 3 ? 25 : 15;
        if (l.id === '3.7') min = 10;
        if (c.id === 10) min = 12;
        expect(n, `Lektion ${l.id}`).toBeGreaterThanOrEqual(min);
      }
    }
  });

  it('ordnet jeden Fehlertyp genau einer vorhandenen Lektion zu und nutzt jeden Typ', () => {
    for (const ft of FEHLERTYPEN) {
      expect(BANK.lessons.has(ft.lektion), ft.id).toBe(true);
      expect((BANK.byType.get(ft.id) ?? []).length, `Aufgaben für ${ft.id}`).toBeGreaterThan(0);
    }
  });
});

describe('Aufgaben', () => {
  it('haben eindeutige Kennungen und alle Pflichtfelder', () => {
    const ids = new Set<string>();
    for (const t of tasks) {
      expect(ids.has(t.id), `doppelt: ${t.id}`).toBe(false);
      ids.add(t.id);
      expect(BANK.lessons.has(t.lektion), `${t.id}: Lektion ${t.lektion}`).toBe(true);
      expect(t.lektion.split('.')[0], t.id).toBe(String(t.kurs));
      expect([1, 2, 3], t.id).toContain(t.stufe);
      expect(fehlertyp(t.fehlertyp), `${t.id}: Fehlertyp ${t.fehlertyp}`).toBeTruthy();
      expect(t.begruendung.trim().length, t.id).toBeGreaterThan(10);
      expect(sentences(t.begruendung), `${t.id}: Begründung zu lang: ${t.begruendung}`).toBeLessThanOrEqual(2);
    }
  });

  it('halten das deutsche Schriftbild ein', () => {
    for (const t of tasks) {
      for (const s of allTexts(t)) {
        expect(s.includes('"'), `${t.id}: gerade Anführungszeichen in „${s}“`).toBe(false);
        expect(/'/.test(s), `${t.id}: gerades Apostroph in „${s}“`).toBe(false);
        expect(/ {2}/.test(s), `${t.id}: doppeltes Leerzeichen in „${s}“`).toBe(false);
        expect(/\s[,.;:!?](?!\.)/.test(s.replace(/\(,\)/g, '').replace(/ – /g, ' ').replace(/\[…\]/g, '')), `${t.id}: Leerzeichen vor Satzzeichen in „${s}“`).toBe(false);
        expect(/z\.B\.|d\.h\./.test(s), `${t.id}: Abkürzung ohne Leerzeichen in „${s}“`).toBe(false);
      }
    }
  });

  it('Komma und Probe: Notation gültig, Lösung vollständig', () => {
    for (const t of tasks) {
      if (t.typ !== 'komma' && t.typ !== 'probe') continue;
      const p = parseKomma(t.text);
      expect(p.gaps.length, t.id).toBeGreaterThan(0);
      if (t.typ === 'probe' || t.kurs === 1) expect(p.tokens.some((x) => x.verb), `${t.id}: keine gebeugten Verben markiert`).toBe(true);
      expect(/[{}]/.test(p.tokens.map((x) => x.text).join(' ')), t.id).toBe(false);
      expect(/[.!?“]$/.test(p.tokens[p.tokens.length - 1].text), `${t.id}: Satzende`).toBe(true);
      // Die Lösung selbst muss richtig sein
      const commas = p.gaps.map((g) => g === 'ja');
      expect(evalKomma(p, commas).richtig, t.id).toBe(true);
    }
  });

  it('Eintippen und Entscheiden: genau eine Lücke, gültige Lösungen', () => {
    for (const t of tasks) {
      if (t.typ === 'eintippen') {
        expect(t.text.split('___').length, t.id).toBe(2);
        expect(t.loesungen.length, t.id).toBeGreaterThan(0);
        expect(new Set(t.loesungen).size, t.id).toBe(t.loesungen.length);
        for (const l of t.loesungen) expect(l.trim(), t.id).toBe(l);
      }
      if (t.typ === 'entscheiden') {
        expect(t.text.split('___').length, t.id).toBe(2);
        expect(t.optionen.length, t.id).toBeGreaterThanOrEqual(2);
        expect(t.optionen.length, t.id).toBeLessThanOrEqual(3);
        expect(t.loesungen.length, t.id).toBeGreaterThan(0);
        for (const l of t.loesungen) expect(t.optionen, t.id).toContain(l);
        expect(new Set(t.optionen).size, t.id).toBe(t.optionen.length);
      }
    }
  });

  it('Umformen: jede Lösung wird als richtig erkannt', () => {
    for (const t of tasks) {
      if (t.typ !== 'umformen') continue;
      expect(t.loesungen.length, t.id).toBeGreaterThan(0);
      for (const l of t.loesungen) expect(evalTyped(l, t.loesungen).richtig, t.id).toBe(true);
      expect(evalTyped(t.vorlage, t.loesungen).richtig, `${t.id}: Vorlage darf nicht richtig sein`).toBe(false);
    }
  });

  it('Fehler finden: Stellen an Wortgrenzen, Lösung fehlerfrei, Original fehlerhaft', () => {
    for (const t of tasks) {
      if (t.typ !== 'fehler' && t.typ !== 'fehlertyp' && t.typ !== 'korrektur') continue;
      const parsed = parseFehler(t.text);
      for (const e of parsed.fehler) {
        if (e.fehlertyp) expect(e.fehlertyp === 'frei' || !!fehlertyp(e.fehlertyp), `${t.id}: Typ ${e.fehlertyp}`).toBe(true);
        const before = parsed.original.slice(0, e.start);
        expect(before === '' || /[\s„(]$/.test(before) || e.falsch === '', `${t.id}: Stelle „${e.falsch}“ beginnt mitten im Wort`).toBe(true);
        const after = parsed.original.slice(e.end);
        expect(after === '' || /^[\s.,;:!?“)]/.test(after), `${t.id}: Stelle „${e.falsch}“ endet mitten im Wort`).toBe(true);
        expect(e.falsch !== e.richtig || e.fehlertyp === 'frei', `${t.id}: Stelle ohne Änderung`).toBe(true);
      }
      const prep = prepareTask(t.text);
      const real = prep.fehler.length;
      if (t.typ !== 'korrektur') expect(real, t.id).toBeLessThanOrEqual(3);
      expect(evalTask(prep, prep.base.loesung).richtig, `${t.id}: Lösung wird nicht als richtig erkannt`).toBe(true);
      if (real > 0) {
        const r = evalTask(prep, prep.base.original);
        expect(r.richtig, `${t.id}: Original gilt als richtig`).toBe(false);
        expect(r.stellen.every((s) => s.ergebnis === 'uebersehen'), `${t.id}: Stellen im Original`).toBe(true);
      }
      if (t.typ === 'korrektur') {
        const words = prep.base.loesung.split(/\s+/).length;
        expect(words, `${t.id}: Länge`).toBeGreaterThanOrEqual(150);
        expect(words, `${t.id}: Länge`).toBeLessThanOrEqual(250);
        expect(real, `${t.id}: Fehlerzahl`).toBeGreaterThanOrEqual(6);
        for (const e of prep.fehler) expect(e.fehlertyp, `${t.id}: Stelle ohne Fehlertyp`).toBeTruthy();
      }
    }
  });

  it('Wort tippen: Umschreibung verrät das Wort nicht', () => {
    for (const t of tasks) {
      if (t.typ !== 'wort') continue;
      expect(t.umschreibung.toLowerCase().includes(t.wort.toLowerCase()), t.id).toBe(false);
    }
  });

  it('Textwiedergabe: Musterlösung besteht alle Prüfungen, Vorlage nicht', () => {
    for (const t of tasks) {
      if (t.typ !== 'textwiedergabe') continue;
      const ok = evalTextwiedergabe(t.muster, t.pruefungen, 3);
      expect(
        ok.checks.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`),
        `${t.id}: Musterlösung`,
      ).toEqual([]);
      expect(ok.einleitungen.length, `${t.id}: Redeeinleitungen in der Musterlösung`).toBeGreaterThanOrEqual(2);
      const bad = evalTextwiedergabe(t.vorlage, t.pruefungen, 3);
      expect(bad.richtig, `${t.id}: Vorlage besteht`).toBe(false);
      for (const p of t.pruefungen) expect(fehlertyp(p.fehlertyp), `${t.id}: ${p.fehlertyp}`).toBeTruthy();
    }
  });
});
