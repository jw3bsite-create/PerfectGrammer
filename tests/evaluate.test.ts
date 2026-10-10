import { describe, expect, it } from 'vitest';
import { evalFehler, evalKomma, evalTyped, evalVerben, matchPattern, prepareFehler, evalTextwiedergabe } from '../src/lib/evaluate';
import { parseKomma } from '../src/lib/markup';

describe('Komma-Notation', () => {
  it('liest Verben, Pflicht- und freigestellte Kommas', () => {
    const p = parseKomma('Er {sagte}, dass er {komme}, und {ging}.');
    expect(p.tokens.map((t) => t.text)).toEqual(['Er', 'sagte', 'dass', 'er', 'komme', 'und', 'ging.']);
    expect(p.tokens.filter((t) => t.verb).map((t) => t.text)).toEqual(['sagte', 'komme', 'ging.']);
    expect(p.gaps).toEqual(['nein', 'ja', 'nein', 'nein', 'ja', 'nein']);
    const q = parseKomma('Sie {las}(,) und er {schrieb}.');
    expect(q.gaps).toEqual(['nein', 'frei', 'nein', 'nein']);
  });
  it('wertet je Position aus', () => {
    const p = parseKomma('Wer {wagt}, {gewinnt}.');
    expect(evalKomma(p, [false, true]).richtig).toBe(true);
    const e = evalKomma(p, [true, false]);
    expect(e.richtig).toBe(false);
    expect(e.gaps.map((g) => g.status)).toEqual(['ueberfluessig', 'fehlt']);
    const q = parseKomma('Sie {las}(,) und er {schrieb}.');
    expect(evalKomma(q, [false, true, false, false]).richtig).toBe(true);
    expect(evalKomma(q, [false, false, false, false]).richtig).toBe(true);
  });
  it('prüft gebeugte Verben', () => {
    const p = parseKomma('Wer {wagt}, {gewinnt}.');
    expect(evalVerben(p, [false, true, true]).richtig).toBe(true);
    expect(evalVerben(p, [true, true, false]).marks).toEqual(['zuviel', 'richtig', 'fehlt']);
  });
});

describe('Getippte Antworten', () => {
  it('ist streng bei Groß- und Kleinschreibung und ß', () => {
    expect(evalTyped('komme', ['komme']).richtig).toBe(true);
    expect(evalTyped('Komme', ['komme']).richtig).toBe(false);
    expect(evalTyped('Strasse', ['Straße']).richtig).toBe(false);
  });
  it('gleicht Leerzeichen und Anführungszeichen aus', () => {
    expect(evalTyped('  Er sagt,  er sei "müde".', ['Er sagt, er sei „müde“.']).richtig).toBe(true);
  });
  it('akzeptiert Varianten', () => {
    const r = evalTyped('seit langem', ['seit Langem']);
    expect(r.richtig).toBe(true);
    expect(r.variante).toBe(true);
  });
  it('liefert die Abweichung Zeichen für Zeichen', () => {
    const r = evalTyped('Rytmus', ['Rhythmus']);
    expect(r.richtig).toBe(false);
    expect(r.diff.filter((d) => d.op === 'fehlt').map((d) => d.items.join(''))).toEqual(['h', 'h']);
  });
});

describe('Fehler finden', () => {
  const prep = prepareFehler('Er [[sagte=>sagte,|k-nebensatz]] dass er komme.');
  it('erkennt gefundene Fehler', () => {
    const r = evalFehler(prep, 'Er sagte, dass er komme.');
    expect(r.richtig).toBe(true);
    expect(r.stellen[0].ergebnis).toBe('gefunden');
  });
  it('erkennt das Komma auch, wenn es am nächsten Wort eingetragen wird', () => {
    expect(evalFehler(prep, 'Er sagte , dass er komme.').richtig).toBe(true);
  });
  it('erkennt übersehene und falsch korrigierte Fehler', () => {
    expect(evalFehler(prep, 'Er sagte dass er komme.').stellen[0].ergebnis).toBe('uebersehen');
    expect(evalFehler(prep, 'Er sagte; dass er komme.').stellen[0].ergebnis).toBe('falsch');
  });
  it('erkennt fälschlich geänderte Stellen', () => {
    const r = evalFehler(prep, 'Er sagte, dass er kommt.');
    expect(r.stellen[0].ergebnis).toBe('gefunden');
    expect(r.falschGeaendert).toEqual([{ vorher: 'komme', nachher: 'kommt' }]);
    expect(r.richtig).toBe(false);
  });
  it('wertet überflüssige Kommas', () => {
    const p = prepareFehler('Nach der Analyse[[,=>|k-ueberfluessig]] zeigt sich ein Widerspruch.');
    expect(evalFehler(p, 'Nach der Analyse zeigt sich ein Widerspruch.').richtig).toBe(true);
    expect(evalFehler(p, 'Nach der Analyse, zeigt sich ein Widerspruch.').stellen[0].ergebnis).toBe('uebersehen');
  });
  it('wertet Zusammenschreibung', () => {
    const p = prepareFehler('Das Gericht wird ihn [[frei sprechen=>freisprechen]].');
    expect(evalFehler(p, 'Das Gericht wird ihn freisprechen.').richtig).toBe(true);
    expect(evalFehler(p, 'Das Gericht wird ihn frei sprechen.').stellen[0].ergebnis).toBe('uebersehen');
  });
  it('trennt benachbarte Fehler', () => {
    const p = prepareFehler('Er [[sagte=>sagte,]] [[das=>dass]] er komme.');
    expect(evalFehler(p, 'Er sagte, dass er komme.').richtig).toBe(true);
    const r = evalFehler(p, 'Er sagte dass er komme.');
    expect(r.stellen.map((s) => s.ergebnis)).toEqual(['uebersehen', 'gefunden']);
    expect(r.falschGeaendert).toEqual([]);
  });
  it('wertet fehlerfreie Sätze', () => {
    const p = prepareFehler('Der Autor stellt fest, dass die These überholt ist.');
    expect(evalFehler(p, p.original).richtig).toBe(true);
    expect(evalFehler(p, 'Der Autor stellt fest, das die These überholt ist.').falschGeaendert.length).toBe(1);
  });
  it('zählt gültige Varianten nicht als Änderung', () => {
    const p = prepareFehler('Er stellt die These mithilfe eines Beispiels infrage.');
    expect(evalFehler(p, 'Er stellt die These mit Hilfe eines Beispiels in Frage.').richtig).toBe(true);
  });
});

describe('Textwiedergabe', () => {
  it('findet Muster mit Platzhalter', () => {
    const w = 'Die Autorin hebt die Bedeutung der Bildung hervor'.split(' ');
    expect(matchPattern(w, 'hebt … hervor')).toBe(true);
    expect(matchPattern(w, 'hebt hervor')).toBe(false);
  });
  it('prüft Verbformen', () => {
    const r = evalTextwiedergabe(
      'Die Autorin betont, die Sprache verändere sich. Sie hebt hervor, man lese heute anders.',
      [
        { label: 'verändert → verändere', erwartet: ['verändere'], vermeiden: ['verändert'], fehlertyp: 'kj-indikativ' },
        { label: 'lesen → lese', erwartet: ['lese', 'läsen', 'würden … lesen'], vermeiden: ['wir'], fehlertyp: 'kj-pronomen' },
      ],
      2,
    );
    expect(r.richtig).toBe(true);
    expect(r.einleitungen.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Freigestellte Stellen', () => {
  it('akzeptiert beide Fassungen', async () => {
    const { prepareTask, evalTask } = await import('../src/lib/evaluate');
    const p = prepareTask('Die Opposition [[protestiert=>protestiert,|frei]] und die Regierung schweigt.');
    expect(p.fehler.length).toBe(0);
    expect(evalTask(p, 'Die Opposition protestiert und die Regierung schweigt.').richtig).toBe(true);
    expect(evalTask(p, 'Die Opposition protestiert, und die Regierung schweigt.').richtig).toBe(true);
    expect(evalTask(p, 'Die Opposition protestiert; und die Regierung schweigt.').richtig).toBe(false);
  });
  it('wertet echte Fehler neben freigestellten Stellen', async () => {
    const { prepareTask, evalTask } = await import('../src/lib/evaluate');
    const p = prepareTask('Er [[sagte=>sagte,|k-nebensatz]] dass er [[komme=>komme,|frei]] und sie nickte.');
    expect(evalTask(p, 'Er sagte, dass er komme und sie nickte.').richtig).toBe(true);
    expect(evalTask(p, 'Er sagte, dass er komme, und sie nickte.').richtig).toBe(true);
    const r = evalTask(p, 'Er sagte dass er komme, und sie nickte.');
    expect(r.richtig).toBe(false);
    expect(r.stellen.length).toBe(1);
  });
});
