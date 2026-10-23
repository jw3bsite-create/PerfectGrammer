// Modul „Zusammenfassen“: Textbank, automatische Prüfhinweise, Lernlogik, Migration.
import { describe, expect, it } from 'vitest';
import { migrate } from '../src/lib/db';
import { evalTyped } from '../src/lib/evaluate';
import { ARTEN, FUNKTIONEN, musterGesamt, saetze, TEXTE, woerter } from '../src/zusammenfassen/daten';
import { kiAntwortLesen } from '../src/zusammenfassen/ki';
import { DEFEKTE, einleitungVariante, niveauAuto, sitzungItems, anzahlTeilaufgaben } from '../src/zusammenfassen/logik';
import { fallenIn, hinweiseZusammenfassung, praeteritum, pruefeEinleitung, umgangssprache, zeilenangaben } from '../src/zusammenfassen/pruefen';
import { leererZStand, type ZState } from '../src/zusammenfassen/typen';

const T0 = '2026-10-23';
const alle = (t: (typeof TEXTE)[number]) => t.absaetze.flat().join(' ');

describe('Zusammenfassen: Textbank', () => {
  it('hat mindestens 40 Texte aus vielen Bereichen, alle drei Stufen, alle Textsorten', () => {
    expect(TEXTE.length).toBeGreaterThanOrEqual(40);
    expect(new Set(TEXTE.map((t) => t.id)).size).toBe(TEXTE.length);
    for (const s of [1, 2, 3]) expect(TEXTE.filter((t) => t.stufe === s).length, `Stufe ${s}`).toBeGreaterThanOrEqual(10);
    for (const ts of ['Kommentar', 'Bericht', 'Essay', 'Sachbuchauszug']) expect(TEXTE.some((t) => t.textsorte === ts), ts).toBe(true);
    const bereiche = new Set(TEXTE.map((t) => t.bereich));
    for (const b of ['epochen', 'philosophie', 'geschichte', 'sprache', 'schule']) expect(bereiche.has(b), b).toBe(true);
    expect(TEXTE.filter((t) => /Romantik|romantisch/i.test(alle(t) + t.titel)).length).toBeGreaterThanOrEqual(4);
  });

  it('Länge nach Stufe, Sinnabschnitte lückenlos, These im These-Abschnitt', () => {
    const grenzen = { 1: [150, 230], 2: [200, 300], 3: [260, 350] } as const;
    const funktionen = new Set(FUNKTIONEN.map((f) => f.id));
    for (const t of TEXTE) {
      const n = woerter(alle(t));
      expect(n, `${t.id}: ${n} Wörter`).toBeGreaterThanOrEqual(grenzen[t.stufe][0]);
      expect(n, `${t.id}: ${n} Wörter`).toBeLessThanOrEqual(grenzen[t.stufe][1]);
      let erwartet = 0;
      for (const a of t.abschnitte) {
        expect(a.von, t.id).toBe(erwartet);
        expect(a.bis, t.id).toBeGreaterThanOrEqual(a.von);
        expect(funktionen.has(a.funktion), `${t.id}: ${a.funktion}`).toBe(true);
        erwartet = a.bis + 1;
      }
      expect(erwartet, t.id).toBe(t.absaetze.length);
      const [ta, ts] = t.these;
      expect(t.absaetze[ta]?.[ts], `${t.id}: These`).toBeTruthy();
      const ab = t.abschnitte.find((a) => a.von <= ta && ta <= a.bis)!;
      expect(ab.funktion === 'these' || ab.auch?.includes('these'), `${t.id}: These-Abschnitt`).toBe(true);
    }
  });

  it('Musterlösung: Einleitung besteht die automatische Prüfung, Funktionsverben, knapp, ohne Fallen', () => {
    for (const t of TEXTE) {
      const e = pruefeEinleitung(t.einleitung, t);
      expect(e.filter((x) => !x.ok).map((x) => x.label), `${t.id}: ${t.einleitung}`).toEqual([]);
      const m = musterGesamt(t);
      expect(saetze(m), `${t.id}: Sätze`).toBeLessThanOrEqual(13);
      // knapp: höchstens 80 Prozent der Textlänge
      expect(woerter(m), `${t.id}: Musterlösung zu lang`).toBeLessThanOrEqual(0.8 * woerter(alle(t)));
      expect(fallenIn(m, t).map((f) => f.wort), `${t.id}: Musterlösung enthält eine Falle`).toEqual([]);
      expect(praeteritum(m), `${t.id}: Präteritum in der Musterlösung`).toEqual([]);
      expect(umgangssprache(m), `${t.id}: Umgangssprache in der Musterlösung`).toEqual([]);
      expect(zeilenangaben(m), t.id).toEqual([]);
      for (const a of t.abschnitte) {
        for (const w of a.verb.toLowerCase().match(/\p{L}+/gu) ?? []) {
          if (w !== 'sich') expect(a.muster.toLowerCase(), `${t.id}: Verb „${a.verb}“`).toContain(w);
        }
        expect(a.verbFalsch.length, t.id).toBeGreaterThanOrEqual(2);
      }
      // Die Musterlösung selbst löst keine Hinweise aus, außer zur Länge
      const h = hinweiseZusammenfassung(m, t, woerter(m)).filter((x) => x.kat !== 'laenge' && x.kat !== 'these');
      expect(h.map((x) => `${x.kat}: ${x.text}`), `${t.id}: Hinweise zur Musterlösung`).toEqual([]);
    }
  });

  it('Teilübungen: Fingertest, Fallen, Synonyme, Kern/Beispiel, Konjunktiv, Schluss', () => {
    for (const t of TEXTE) {
      const text = alle(t).toLowerCase();
      for (const f of t.fallen) expect(text.includes(f.wort.toLowerCase()), `${t.id}: Falle ${f.wort} steht im Text`).toBe(false);
      expect(t.fingertest.length, t.id).toBeGreaterThanOrEqual(2);
      for (const f of t.fingertest) {
        expect(f.satz.includes(f.falsch), `${t.id}: ${f.falsch}`).toBe(true);
        expect(text.includes(f.falsch.toLowerCase()), `${t.id}: Fingertest-Wort steht im Text`).toBe(false);
      }
      expect(new Set(t.kernBeispiel.map((x) => x.art)), t.id).toEqual(new Set(['kern', 'beispiel']));
      for (const x of t.kernBeispiel) expect(t.abschnitte[x.abschnitt], t.id).toBeTruthy();
      expect(new Set(t.synonyme.map((x) => x.gleich)), t.id).toEqual(new Set([true, false]));
      for (const x of t.synonyme) expect(text.includes(x.original.toLowerCase()), `${t.id}: ${x.original}`).toBe(true);
      expect(t.konjunktiv.length, t.id).toBeGreaterThanOrEqual(2);
      for (const k of t.konjunktiv) {
        for (const l of k.loesungen) expect(evalTyped(l, k.loesungen).richtig, `${t.id}: ${l}`).toBe(true);
        expect(evalTyped(k.vorlage, k.loesungen).richtig, `${t.id}: Vorlage gilt als richtig`).toBe(false);
        expect(['k1', 'wuerde', 'seienhaetten']).toContain(k.regel);
      }
      expect(new Set(t.schlussFalsch.map((x) => x.art)), t.id).toEqual(new Set(['teilaspekt', 'dazugedichtet', 'wertung']));
    }
    // Im ganzen Bestand kommen alle drei Konjunktivregeln vor
    const regeln = new Set(TEXTE.flatMap((t) => t.konjunktiv.map((k) => k.regel)));
    expect(regeln.size).toBe(3);
  });
});

describe('Zusammenfassen: Einleitung prüfen', () => {
  it('jede Variante hat genau den gewünschten Mangel', () => {
    for (const t of TEXTE.slice(0, 10)) {
      const ok = einleitungVariante(t, 'ok');
      expect(pruefeEinleitung(ok, t).every((x) => x.ok), `${t.id}: ${ok}`).toBe(true);
      const varianten = new Set(DEFEKTE.map((d) => einleitungVariante(t, d)));
      expect(varianten.size, t.id).toBe(DEFEKTE.length);
      expect(pruefeEinleitung(einleitungVariante(t, 'autor'), t).find((x) => x.label.startsWith('Autor'))!.ok).toBe(false);
      expect(pruefeEinleitung(einleitungVariante(t, 'titel'), t).find((x) => x.label.startsWith('Titel'))!.ok).toBe(false);
      expect(pruefeEinleitung(einleitungVariante(t, 'erschienen'), t).find((x) => x.label.startsWith('Erscheinungsdatum'))!.ok).toBe(false);
      expect(zeilenangaben(einleitungVariante(t, 'zeilen')).length).toBeGreaterThan(0);
      expect(praeteritum(einleitungVariante(t, 'praeteritum')).length).toBeGreaterThan(0);
    }
  });
});

describe('Zusammenfassen: automatische Hinweise', () => {
  it('findet Umgangssprache, Zeichen, Zeilenangaben, Präteritum und Abschwächung', () => {
    const t = TEXTE[0];
    const h = hinweiseZusammenfassung('Erstmal stellte die Autorin dar, dass 30 % der Schulen Handys verbieten (Z. 3). Sie meint, die Ministerien sollten mehr tun.', t, 60);
    const kats = h.map((x) => x.kat);
    expect(kats).toContain('umgangssprache');
    expect(kats).toContain('praeteritum');
    expect(kats).toContain('abschwaechung');
    expect(h.some((x) => x.text.startsWith('Zeilenangaben'))).toBe(true);
  });
});

describe('Zusammenfassen: Lernlogik', () => {
  it('stellt Übungen im Wechsel zusammen: nie zweimal dieselbe Art oder derselbe Text hintereinander', () => {
    const s: ZState = { ...leererZStand(), niveau: 3 };
    const items = sitzungItems(s, ARTEN.map((a) => a.id), 12, T0, 'x');
    expect(items).toHaveLength(12);
    for (let i = 1; i < items.length; i++) {
      expect(items[i].art).not.toBe(items[i - 1].art);
      expect(items[i].textId).not.toBe(items[i - 1].textId);
    }
    for (const it of items) {
      const t = TEXTE.find((x) => x.id === it.textId)!;
      expect(it.n).toBeLessThan(anzahlTeilaufgaben(t, it.art));
    }
  });

  it('häufige Fehler machen die passende Übungsart häufiger', () => {
    const fehler = Array.from({ length: 8 }, (_, i) => ({ zeit: i, tag: T0, kat: 'dazugedichtet' as const, ok: false, quelle: 'fingertest' as const, textId: 'Z01' }));
    const s: ZState = { ...leererZStand(), niveau: 3, ereignisse: fehler };
    let finger = 0;
    let ohne = 0;
    for (let k = 0; k < 20; k++) {
      finger += sitzungItems(s, ARTEN.map((a) => a.id), 10, T0, `a${k}`).filter((i) => i.art === 'fingertest' || i.art === 'synonym').length;
      ohne += sitzungItems({ ...s, ereignisse: [] }, ARTEN.map((a) => a.id), 10, T0, `a${k}`).filter((i) => i.art === 'fingertest' || i.art === 'synonym').length;
    }
    expect(finger).toBeGreaterThan(ohne);
  });

  it('Stufe: zuerst 1, nach vier ganzen Zusammenfassungen 2, nach zehn 3', () => {
    const v = (i: number) => ({ id: `v${i}`, textId: 'Z01', start: i, phase: 'fertig' as const, plan: [], theseAbsatz: null, fassung1: '' });
    expect(niveauAuto(leererZStand())).toBe(1);
    expect(niveauAuto({ ...leererZStand(), volltexte: [0, 1, 2, 3].map(v) })).toBe(2);
    expect(niveauAuto({ ...leererZStand(), volltexte: Array.from({ length: 10 }, (_, i) => v(i)) })).toBe(3);
  });
});

describe('Zusammenfassen: Speicher und KI', () => {
  it('Datenversion 2 → 3 ergänzt einen leeren Stand', () => {
    const d = migrate({ settings: {}, schwaechen: undefined }, 2);
    expect(d.zusammenfassen.ereignisse).toEqual([]);
    expect(d.zusammenfassen.ki.aktiv).toBe(false);
  });

  it('liest die Antwort der KI auch mit Text drumherum', () => {
    expect(kiAntwortLesen('Hier: {"fehler":[{"kategorie":"Präteritum","stelle":"stellte dar","art":"Präteritum statt Präsens"}]} Ende')).toHaveLength(1);
    expect(kiAntwortLesen('kein json')).toEqual([]);
  });
});
