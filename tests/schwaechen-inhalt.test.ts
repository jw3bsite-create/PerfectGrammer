// Inhaltsprüfung des Moduls „Meine Schwächen“: Jede Aufgabe ist lösbar, jede Lösung wird erkannt.
import { describe, expect, it } from 'vitest';
import { BANK_AUFGABEN, KATEGORIEN, kategorie, regel, regelOptionen, transferKats } from '../src/schwaechen/daten';
import { pruefeSchreiben } from '../src/schwaechen/pruefen';
import { evalTask, evalTyped, prepareTask } from '../src/lib/evaluate';
import { parseFehler, parseKomma } from '../src/lib/markup';

// Satzende: Satzzeichen vor einem Großbuchstaben oder am Ende (Abkürzungen wie „bspw. steht“ zählen nicht).
const sätze = (s: string) => (s.match(/[.!?](?=\s+[A-ZÄÖÜ„]|$)/g) ?? []).length;

describe('Meine Schwächen: Kategorien', () => {
  it('hat zwölf Kategorien mit Methode, Regeln, Fehlregeln und Prüffrage', () => {
    expect(KATEGORIEN.map((k) => k.id)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12']);
    for (const k of KATEGORIEN) {
      expect(k.methode.length, k.id).toBeGreaterThan(40);
      expect(k.regeln.length, k.id).toBeGreaterThanOrEqual(3);
      expect(k.mythen.length, k.id).toBeGreaterThanOrEqual(2);
      expect(k.checkfrage.endsWith('?'), k.id).toBe(true);
      expect(k.beispiele.length, k.id).toBeGreaterThan(0);
    }
  });

  it('verweist nur auf vorhandene Lektionen', async () => {
    const { getLesson } = await import('../src/lib/content');
    for (const k of KATEGORIEN) for (const l of k.kurse) expect(getLesson(l), `${k.id} → ${l}`).toBeTruthy();
  });

  it('hat mindestens 25 Aufgaben je Kategorie in mindestens drei Übungsformen, jede Regel kommt vor', () => {
    for (const k of KATEGORIEN) {
      const liste = BANK_AUFGABEN.filter((a) => a.kat === k.id);
      expect(liste.length, k.id).toBeGreaterThanOrEqual(25);
      expect(new Set(liste.map((a) => a.typ)).size, k.id).toBeGreaterThanOrEqual(3);
      expect(liste.some((a) => a.typ === 'schreiben'), `${k.id}: Selbst schreiben`).toBe(true);
      for (const r of k.regeln) expect(liste.some((a) => a.regel === r.id), `${k.id}: Regel ${r.id} ohne Aufgabe`).toBe(true);
    }
    expect(BANK_AUFGABEN.filter((a) => a.kat === 'T').length).toBeGreaterThanOrEqual(12);
  });
});

describe('Meine Schwächen: Aufgaben', () => {
  it('hat eindeutige Kennungen, gültige Regeln und kurze Begründungen', () => {
    const ids = new Set<string>();
    for (const a of BANK_AUFGABEN) {
      expect(ids.has(a.id), a.id).toBe(false);
      ids.add(a.id);
      if (a.kat !== 'T') {
        expect(regel(a.regel), `${a.id}: Regel ${a.regel}`).toBeTruthy();
        expect(a.regel.startsWith(`${a.kat}.`), a.id).toBe(true);
        const opts = regelOptionen(a);
        expect(opts.length, a.id).toBe(4);
        expect(opts.filter((o) => o.id === a.regel).length, a.id).toBe(1);
        expect(new Set(opts.map((o) => o.id)).size, a.id).toBe(4);
      }
      expect(sätze(a.begruendung), `${a.id}: Begründung zu lang`).toBeLessThanOrEqual(2);
      expect(/[“"]\s|  /.test(a.begruendung.replace(/“ /g, '')), `${a.id}: Typografie`).toBe(false);
    }
  });

  it('Entscheiden und Lücke: eine Lücke, Lösung unter den Optionen und als richtig erkannt', () => {
    for (const a of BANK_AUFGABEN) {
      if (a.typ === 'entscheiden') {
        expect(a.text.split('___').length, a.id).toBe(2);
        expect(a.optionen.length, a.id).toBe(2);
        expect(a.loesungen.every((l) => a.optionen.includes(l)), a.id).toBe(true);
      }
      if (a.typ === 'eintippen') {
        expect(a.text.split('___').length, a.id).toBe(2);
        for (const l of a.loesungen) expect(evalTyped(l, a.loesungen).richtig, a.id).toBe(true);
      }
    }
  });

  it('Umformen: jede Lösung wird erkannt, die Vorlage nicht', () => {
    for (const a of BANK_AUFGABEN) {
      if (a.typ !== 'umformen') continue;
      for (const l of a.loesungen) expect(evalTyped(l, a.loesungen).richtig, a.id).toBe(true);
      expect(evalTyped(a.vorlage, a.loesungen).richtig, `${a.id}: Vorlage gilt als richtig`).toBe(false);
    }
  });

  it('Fehlerjagd: genau ein Fehler, Lösung richtig, Original falsch; Transfer: zwei bis drei Fehler aus verschiedenen Kategorien', () => {
    for (const a of BANK_AUFGABEN) {
      if (a.typ !== 'fehler') continue;
      const prep = prepareTask(a.text);
      if (a.kat === 'T') {
        expect(prep.fehler.length, a.id).toBeGreaterThanOrEqual(2);
        expect(prep.fehler.length, a.id).toBeLessThanOrEqual(3);
        expect(transferKats(a).length, `${a.id}: verschiedene Kategorien`).toBe(prep.fehler.length);
        for (const f of parseFehler(a.text).fehler) expect(regel(f.fehlertyp ?? ''), `${a.id}: ${f.fehlertyp}`).toBeTruthy();
      } else {
        expect(prep.fehler.length, a.id).toBe(1);
      }
      expect(evalTask(prep, prep.base.loesung).richtig, `${a.id}: Lösung nicht erkannt`).toBe(true);
      const r = evalTask(prep, prep.base.original);
      expect(r.richtig, `${a.id}: Original gilt als richtig`).toBe(false);
      expect(r.stellen.every((s) => s.ergebnis === 'uebersehen'), a.id).toBe(true);
    }
  });

  it('Komma setzen: Notation gültig', () => {
    for (const a of BANK_AUFGABEN) if (a.typ === 'komma') expect(() => parseKomma(a.text), a.id).not.toThrow();
  });

  it('Selbst schreiben: Beispiel besteht alle Prüfungen, Gegenbeispiel nicht', () => {
    for (const a of BANK_AUFGABEN) {
      if (a.typ !== 'schreiben') continue;
      const ok = pruefeSchreiben(a.beispiel, a.pruefungen);
      expect(ok.richtig, `${a.id}: Beispiel ${JSON.stringify(ok.teile)}`).toBe(true);
      if (a.gegenbeispiel) expect(pruefeSchreiben(a.gegenbeispiel, a.pruefungen).richtig, `${a.id}: Gegenbeispiel besteht`).toBe(false);
    }
  });

  it('jede Kategorie hat ihre Methode in der Rückmeldung (Begründungen nennen sie)', () => {
    const stichwort: Record<string, RegExp> = {
      S1: /Kette|Rahmen|dass|Frage/, S2: /Begleiterprobe|Herkunftsw/, S3: /Ein-Wort-Regel|verschmolzen/, S4: /Ersatzprobe|Zweck|Folge/,
      S5: /Logikprobe/, S6: /Zeitprobe/, S7: /Verbprobe|Komma|Einschub|Beisatz/, S8: /Wörterbuch-Test/, S9: /Bezugsprobe|Nach alles/,
      S10: /Wendungsprobe/, S11: /Sperrlisten-Probe/, S12: /Rahmentest/,
    };
    for (const a of BANK_AUFGABEN) if (a.kat !== 'T') expect(stichwort[a.kat].test(a.begruendung), `${a.id}: ${a.begruendung}`).toBe(true);
    expect(kategorie('S1')?.methode).toContain('Entscheidungskette');
  });
});
