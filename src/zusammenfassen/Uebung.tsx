// Teilübungen des Moduls „Zusammenfassen“ und die Übungsansicht, die sie nacheinander zeigt.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Confirm, Empty, Progress } from '../components/ui';
import { NO_AUTOCORRECT, typingTarget, useKeys } from '../exercises/common';
import { evalTyped } from '../lib/evaluate';
import { typo } from '../lib/normalize';
import { navigate } from '../lib/router';
import { useApp } from '../lib/store';
import { ergebnisSpeichern, sitzungAbbrechen, sitzungBeenden, starteSitzung } from './aktionen';
import { abschnittText, art as artDef, funktionLabel, REGELN, text as textVon, TEXTSORTEN, woerter } from './daten';
import { DEFEKT_GRUND, DEFEKT_LABEL, DEFEKTE, defektOptionen, einleitungVariante, funktionsOptionen, schlussOptionen, verbOptionen, verdichtbar } from './logik';
import { hinweiseSatz, praeteritum, pruefeEinleitung, wertungen, zeilenangaben } from './pruefen';
import { Block, HinweisListe, JaNein, PunktListe, Rueckmeldung, TextAnzeige, WortZaehler } from './Teile';
import type { ZArt, ZKat, ZText } from './typen';

type Kats = { kat: ZKat; ok: boolean }[];

interface UProps {
  t: ZText;
  n: number;
  onResult: (richtig: boolean, kats: Kats) => void;
  onWeiter: () => void;
  letzte: boolean;
}

// ---------- Auswahl mit Ziffern ----------

function Optionen({
  optionen,
  gewaehlt,
  richtig,
  onWahl,
  label,
  data,
}: {
  optionen: string[];
  gewaehlt: number | null;
  richtig: number[];
  onWahl: (i: number) => void;
  label: string;
  data?: string;
}) {
  useKeys(gewaehlt === null, (e) => {
    if (typingTarget(e)) return;
    const n = Number(e.key);
    if (n >= 1 && n <= optionen.length) {
      e.preventDefault();
      onWahl(n - 1);
    }
  });
  return (
    <div className="options" role="group" aria-label={label}>
      {optionen.map((o, i) => {
        let cls = 'option ui';
        let status: string | null = null;
        if (gewaehlt !== null) {
          if (richtig.includes(i)) {
            cls += ' st-ok';
            status = 'richtig';
          } else if (gewaehlt === i) {
            cls += ' st-bad';
            status = 'falsch';
          }
        }
        return (
          <button key={i} className={cls} onClick={() => onWahl(i)} disabled={gewaehlt !== null} autoFocus={i === 0} data-option={data ? `${data}-${i}` : i}>
            <span className="kbd">{i + 1}</span>
            <span>{typo(o)}</span>
            {status ? (
              <span className="opt-status">
                <Icon name={status === 'richtig' ? 'check' : 'cross'} />
                {status}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function Anweisung({ children }: { children: string }) {
  return <p className="task-instruction">{children}</p>;
}

// ---------- Einleitung ----------

function TextsorteU({ t, onResult, onWeiter, letzte }: UProps) {
  const [wahl, setWahl] = useState<number | null>(null);
  const richtig = TEXTSORTEN.indexOf(t.textsorte);
  const waehle = (i: number) => {
    if (wahl !== null) return;
    setWahl(i);
    onResult(i === richtig, [{ kat: 'einleitung', ok: i === richtig }]);
  };
  return (
    <div>
      <Anweisung>Lies den Text. Um welche Textsorte handelt es sich?</Anweisung>
      <TextAnzeige t={t} />
      <div style={{ marginTop: 20 }}>
        <Optionen optionen={TEXTSORTEN} gewaehlt={wahl} richtig={[richtig]} onWahl={waehle} label="Textsorten" data="sorte" />
      </div>
      {wahl !== null ? (
        <Rueckmeldung ok={wahl === richtig} kopf={wahl === richtig ? `Richtig: ${t.textsorte}` : `Es ist ein ${t.textsorte === 'Sachbuchauszug' ? 'Auszug aus einem Sachbuch' : t.textsorte}`} onWeiter={onWeiter} letzte={letzte}>
          <Block label="Woran man es erkennt">
            <p className="fb-reason">{typo(t.textsorteGrund)}</p>
          </Block>
        </Rueckmeldung>
      ) : null}
    </div>
  );
}

function EinleitungPruefenU({ t, n, onResult, onWeiter, letzte }: UProps) {
  const d = DEFEKTE[n % DEFEKTE.length];
  const variante = useMemo(() => einleitungVariante(t, d), [t, d]);
  const opts = useMemo(() => defektOptionen(t, d), [t, d]);
  const [wahl, setWahl] = useState<number | null>(null);
  const richtig = opts.indexOf(d);
  const waehle = (i: number) => {
    if (wahl !== null) return;
    setWahl(i);
    onResult(i === richtig, [{ kat: 'einleitung', ok: i === richtig }]);
  };
  return (
    <div>
      <Anweisung>Prüfe die Einleitung mit der Quellenangabe. Was fehlt oder stimmt nicht?</Anweisung>
      <details className="zs-details">
        <summary>Text „{typo(t.titel)}“ ansehen</summary>
        <TextAnzeige t={t} quelle={false} />
      </details>
      <div className="source-box" style={{ marginTop: 12 }}>
        <div className="eyebrow">Quellenangabe</div>
        {typo(`${t.autor}: ${t.titel}. ${t.medium}, ${t.datum}.`)}
        <div className="small muted" style={{ marginTop: 6 }}>
          Textsorte laut Lehrkraft: {t.textsorte}
        </div>
      </div>
      <div className="source-box" style={{ marginTop: 12 }} data-einleitung>
        <div className="eyebrow">Einleitung</div>
        {typo(variante)}
      </div>
      <div style={{ marginTop: 20 }}>
        <Optionen optionen={opts.map((o) => DEFEKT_LABEL[o])} gewaehlt={wahl} richtig={[richtig]} onWahl={waehle} label="Mängel" data="defekt" />
      </div>
      {wahl !== null ? (
        <Rueckmeldung ok={wahl === richtig} kopf={wahl === richtig ? 'Richtig' : `Richtig wäre: ${DEFEKT_LABEL[d]}`} onWeiter={onWeiter} letzte={letzte}>
          <Block label="Begründung">
            <p className="fb-reason">{DEFEKT_GRUND[d]}</p>
          </Block>
          {d !== 'ok' ? (
            <Block label="Vollständig">
              <p className="fb-solution">{typo(einleitungVariante(t, 'ok'))}</p>
            </Block>
          ) : null}
        </Rueckmeldung>
      ) : null}
    </div>
  );
}

function EinleitungSchreibenU({ t, onResult, onWeiter, letzte }: UProps) {
  const [eigen, setEigen] = useState('');
  const [phase, setPhase] = useState<'schreiben' | 'pruefen' | 'fertig'>('schreiben');
  const [ok, setOk] = useState(false);
  const teile = useMemo(() => (phase === 'schreiben' ? [] : pruefeEinleitung(eigen, t)), [phase, eigen, t]);
  const p = phase === 'schreiben' ? [] : praeteritum(eigen);
  const w = phase === 'schreiben' ? [] : wertungen(eigen);
  const z = phase === 'schreiben' ? [] : zeilenangaben(eigen);
  const abgeben = () => {
    if (eigen.trim().split(/\s+/).length < 5) return;
    setPhase('pruefen');
  };
  return (
    <div>
      <Anweisung>Schreib die Einleitung: höchstens zwei Sätze mit Textsorte, Titel, Verfasser, Erscheinungsort und -datum, Thema und Kernaussage.</Anweisung>
      <TextAnzeige t={t} einklappbar />
      <div className="answer-area" style={{ marginTop: 16 }}>
        <textarea
          className="textarea read"
          rows={4}
          value={eigen}
          onChange={(e) => setEigen(e.target.value)}
          readOnly={phase !== 'schreiben'}
          aria-label="Deine Einleitung"
          placeholder="In dem Kommentar „…“ von …, erschienen am … in …, geht es um …"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              abgeben();
            }
          }}
          autoFocus
          {...NO_AUTOCORRECT}
        />
        <div className="row between wrap" style={{ marginTop: 8, gap: 8 }}>
          <WortZaehler n={woerter(eigen)} />
          {phase === 'schreiben' ? (
            <button className="btn primary" onClick={abgeben} disabled={eigen.trim().split(/\s+/).length < 5}>
              Prüfen <span className="kbd">↵</span>
            </button>
          ) : null}
        </div>
      </div>
      {phase !== 'schreiben' ? (
        <div className="card zs-auswertung" style={{ marginTop: 20 }}>
          <Block label="Automatisch geprüft">
            <PunktListe
              teile={[
                ...teile,
                { label: 'Keine eigene Wertung', ok: !w.length },
                { label: 'Keine Zeilenangabe', ok: !z.length },
                { label: 'Präsens (kein Präteritum gefunden)', ok: !p.length },
              ]}
            />
          </Block>
          <Block label="Musterlösung">
            <p className="fb-solution">{typo(t.einleitung)}</p>
          </Block>
          {phase === 'pruefen' ? (
            <JaNein
              fragen={[{ id: 'kern', frage: 'Enthält deine Einleitung die Kernaussage, also die These des Textes?' }]}
              onFertig={(a) => {
                const auto = teile.every((x) => x.ok) && !w.length && !z.length;
                const r = auto && a.kern && !p.length;
                setOk(r);
                setPhase('fertig');
                onResult(r, [
                  { kat: 'einleitung', ok: auto && a.kern },
                  { kat: 'praeteritum', ok: !p.length },
                ]);
              }}
            />
          ) : null}
        </div>
      ) : null}
      {phase === 'fertig' ? <Rueckmeldung ok={ok} kopf={ok ? 'Vollständige Einleitung' : 'Die Einleitung ist noch nicht vollständig'} onWeiter={onWeiter} letzte={letzte} /> : null}
    </div>
  );
}

// ---------- Hauptteil ----------

function StrukturU({ t, onResult, onWeiter, letzte }: UProps) {
  const starts = useMemo(() => new Set(t.abschnitte.map((a) => a.von)), [t]);
  const [grenzen, setGrenzen] = useState<boolean[]>(() => t.absaetze.map((_, i) => i === 0));
  const [phase, setPhase] = useState<'grenzen' | 'funktionen' | 'fertig'>('grenzen');
  const [wahl, setWahl] = useState<Record<number, string>>({});
  const grenzOk = t.absaetze.every((_, i) => grenzen[i] === starts.has(i));
  const funkOk = (k: number) => {
    const a = t.abschnitte[k];
    return wahl[k] === a.funktion || !!a.auch?.includes(wahl[k] as never);
  };
  const alleFunk = t.abschnitte.every((_, k) => funkOk(k));
  return (
    <div>
      <Anweisung>
        {phase === 'grenzen'
          ? 'Schritt 1 von 2: Teile den Text in Sinnabschnitte. Tippe zwischen zwei Absätze, wo ein neuer Gedanke beginnt. Mehrere Absätze können einen Abschnitt bilden.'
          : 'Schritt 2 von 2: Welche Funktion hat jeder Sinnabschnitt?'}
      </Anweisung>
      {phase === 'grenzen' ? (
        <div className="zs-text" data-text={t.id}>
          <h3 className="zs-titel">{typo(t.titel)}</h3>
          {t.absaetze.map((abs, i) => (
            <div key={i}>
              {i > 0 ? (
                <button
                  type="button"
                  className={`zs-grenze${grenzen[i] ? ' an' : ''}`}
                  aria-pressed={grenzen[i]}
                  data-grenze={i}
                  onClick={() => setGrenzen(grenzen.map((g, k) => (k === i ? !g : g)))}
                >
                  {grenzen[i] ? 'Neuer Sinnabschnitt beginnt hier' : 'gehört zum selben Abschnitt'}
                </button>
              ) : null}
              <p className="zs-absatz">
                <span className="zs-nr">{i + 1}</span>
                {typo(abs.join(' '))}
              </p>
            </div>
          ))}
          <div className="actions">
            <button className="btn primary" onClick={() => setPhase('funktionen')}>
              Abschnitte prüfen
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={`notice ${grenzOk ? 'info' : 'error'}`} style={{ marginBottom: 16 }} data-grenzen={grenzOk ? 'ok' : 'falsch'}>
            <Icon name={grenzOk ? 'checkCircle' : 'alert'} />
            <span>
              {grenzOk
                ? 'Die Sinnabschnitte stimmen.'
                : `Die Sinnabschnitte sind anders: ${t.abschnitte.map((a, k) => `${k + 1}: Absatz ${a.von + 1}${a.bis > a.von ? `–${a.bis + 1}` : ''}`).join(' · ')}. Weiter mit diesen Abschnitten.`}
            </span>
          </div>
          {t.abschnitte.map((a, k) => {
            const opts = funktionsOptionen(t, k);
            return (
              <div key={k} className="card zs-abschnitt" data-abschnitt={k}>
                <div className="eyebrow">
                  Abschnitt {k + 1} · Absatz {a.von + 1}
                  {a.bis > a.von ? `–${a.bis + 1}` : ''}
                </div>
                <p className="zs-absatz klein">{typo(abschnittText(t, k).map((x) => x.join(' ')).join(' '))}</p>
                <div className="chips" role="group" aria-label={`Funktion von Abschnitt ${k + 1}`}>
                  {opts.map((f) => {
                    let cls = 'chip';
                    if (phase === 'fertig') {
                      if (f === a.funktion || a.auch?.includes(f)) cls += ' st-ok';
                      else if (wahl[k] === f) cls += ' st-bad';
                    }
                    return (
                      <button key={f} className={cls} aria-pressed={wahl[k] === f} disabled={phase === 'fertig'} onClick={() => setWahl({ ...wahl, [k]: f })} data-funktion={f}>
                        {funktionLabel(f)}
                      </button>
                    );
                  })}
                </div>
                {phase === 'fertig' ? <p className="small" style={{ marginTop: 10 }}>{typo(a.muster)}</p> : null}
              </div>
            );
          })}
          {phase === 'funktionen' ? (
            <div className="actions">
              <button
                className="btn primary"
                disabled={t.abschnitte.some((_, k) => !wahl[k])}
                onClick={() => {
                  setPhase('fertig');
                  onResult(grenzOk && alleFunk, [
                    { kat: 'struktur', ok: grenzOk },
                    { kat: 'struktur', ok: alleFunk },
                  ]);
                }}
              >
                Funktionen prüfen
              </button>
            </div>
          ) : (
            <Rueckmeldung
              ok={grenzOk && alleFunk}
              kopf={grenzOk && alleFunk ? 'Struktur erkannt' : `Abschnitte ${grenzOk ? 'richtig' : 'falsch'}, Funktionen ${t.abschnitte.filter((_, k) => funkOk(k)).length} von ${t.abschnitte.length} richtig`}
              onWeiter={onWeiter}
              letzte={letzte}
            />
          )}
        </>
      )}
    </div>
  );
}

function TheseU({ t, onResult, onWeiter, letzte }: UProps) {
  const [wahl, setWahl] = useState<[number, number] | null>(null);
  const [ta, ts] = t.these;
  const ok = !!wahl && wahl[0] === ta && wahl[1] === ts;
  const abschnitt = t.abschnitte.find((a) => a.von <= ta && ta <= a.bis);
  return (
    <div>
      <Anweisung>Tippe den Satz an, in dem der Autor Stellung bezieht (die These).</Anweisung>
      <TextAnzeige
        t={t}
        satzKlick={(a, s) => {
          if (wahl) return;
          setWahl([a, s]);
          const r = a === ta && s === ts;
          onResult(r, [{ kat: 'these', ok: r }]);
        }}
        satzKlasse={(a, s) => {
          if (!wahl) return undefined;
          if (a === ta && s === ts) return 'st-ok';
          if (wahl[0] === a && wahl[1] === s) return 'st-bad';
          return undefined;
        }}
      />
      {wahl ? (
        <Rueckmeldung ok={ok} kopf={ok ? 'Richtig, das ist die These' : 'Die These steht woanders'} onWeiter={onWeiter} letzte={letzte}>
          <Block label="These">
            <p className="fb-solution">{typo(t.absaetze[ta][ts])}</p>
          </Block>
          {abschnitt ? (
            <Block label="In der Zusammenfassung">
              <p className="fb-reason">{typo(abschnitt.muster)}</p>
            </Block>
          ) : null}
        </Rueckmeldung>
      ) : null}
    </div>
  );
}

function AbschnittAnzeige({ t, k }: { t: ZText; k: number }) {
  const a = t.abschnitte[k];
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        „{typo(t.titel)}“ · Abschnitt {k + 1} von {t.abschnitte.length}
      </div>
      <TextAnzeige t={t} von={a.von} bis={a.bis} quelle={false} titel={false} />
    </div>
  );
}

function KernBeispielU({ t, n, onResult, onWeiter, letzte }: UProps) {
  const x = t.kernBeispiel[n];
  const [wahl, setWahl] = useState<number | null>(null);
  const richtig = x.art === 'kern' ? 0 : 1;
  return (
    <div>
      <Anweisung>Gibt der Satz den Kern des Abschnitts wieder oder nur ein Beispiel?</Anweisung>
      <AbschnittAnzeige t={t} k={x.abschnitt} />
      <div className="source-box" style={{ marginTop: 14 }}>
        <div className="eyebrow">Satz aus einer Zusammenfassung</div>
        {typo(x.satz)}
      </div>
      <div style={{ marginTop: 20 }}>
        <Optionen
          optionen={['Kern des Abschnitts', 'Nur ein Beispiel oder Detail']}
          gewaehlt={wahl}
          richtig={[richtig]}
          onWahl={(i) => {
            if (wahl !== null) return;
            setWahl(i);
            onResult(i === richtig, [{ kat: 'beispiel', ok: i === richtig }]);
          }}
          label="Kern oder Beispiel"
          data="kb"
        />
      </div>
      {wahl !== null ? (
        <Rueckmeldung ok={wahl === richtig} onWeiter={onWeiter} letzte={letzte}>
          <Block label="Begründung">
            <p className="fb-reason">{typo(x.grund)}</p>
          </Block>
          <Block label="Kern des Abschnitts">
            <p className="fb-solution">{typo(t.abschnitte[x.abschnitt].muster)}</p>
          </Block>
        </Rueckmeldung>
      ) : null}
    </div>
  );
}

function FunktionsverbU({ t, n, onResult, onWeiter, letzte }: UProps) {
  const a = t.abschnitte[n];
  const opts = useMemo(() => verbOptionen(t, n), [t, n]);
  const [wahl, setWahl] = useState<number | null>(null);
  const richtig = opts.indexOf(a.verb);
  const falsch = wahl !== null && wahl !== richtig ? a.verbFalsch.find((v) => v.verb === opts[wahl]) : undefined;
  const hatSchwach = a.verbFalsch.some((v) => v.schwach);
  return (
    <div>
      <Anweisung>Welches Funktionsverb trifft, was der Autor in diesem Abschnitt tut?</Anweisung>
      <AbschnittAnzeige t={t} k={n} />
      <p className="zs-lueckensatz">Der Verfasser … in diesem Abschnitt</p>
      <Optionen
        optionen={opts}
        gewaehlt={wahl}
        richtig={[richtig]}
        onWahl={(i) => {
          if (wahl !== null) return;
          setWahl(i);
          const ok = i === richtig;
          const fv = a.verbFalsch.find((v) => v.verb === opts[i]);
          onResult(ok, ok ? [{ kat: hatSchwach ? 'abschwaechung' : 'struktur', ok: true }] : [{ kat: fv?.schwach ? 'abschwaechung' : 'struktur', ok: false }]);
        }}
        label="Funktionsverben"
        data="verb"
      />
      {wahl !== null ? (
        <Rueckmeldung ok={wahl === richtig} kopf={wahl === richtig ? `Richtig: ${a.verb}` : `Treffender: ${a.verb}`} onWeiter={onWeiter} letzte={letzte}>
          {falsch ? (
            <Block label={`Warum nicht „${falsch.verb}“`}>
              <p className="fb-reason">{typo(falsch.grund)}</p>
            </Block>
          ) : null}
          <Block label="So in der Zusammenfassung">
            <p className="fb-solution">{typo(a.muster)}</p>
          </Block>
        </Rueckmeldung>
      ) : null}
    </div>
  );
}

function FingertestU({ t, n, onResult, onWeiter, letzte }: UProps) {
  const x = t.fingertest[n];
  const toks = useMemo(() => {
    const out: { w: string; a: number; b: number }[] = [];
    for (const m of x.satz.matchAll(/\S+/g)) out.push({ w: m[0], a: m.index!, b: m.index! + m[0].length });
    return out;
  }, [x.satz]);
  const fa = x.satz.indexOf(x.falsch);
  const fb = fa + x.falsch.length;
  const imFalsch = (i: number) => toks[i].a < fb && toks[i].b > fa;
  const [mark, setMark] = useState<Set<number>>(new Set());
  const [fertig, setFertig] = useState(false);
  const ok = mark.size > 0 && [...mark].every(imFalsch);
  return (
    <div>
      <Anweisung>Fingertest: Ein Wort oder eine Wendung in diesem Satz steht so nicht im Text. Markiere es.</Anweisung>
      <TextAnzeige t={t} einklappbar />
      <div className="source-box zs-fingersatz" style={{ marginTop: 14 }}>
        <div className="eyebrow">Satz aus einer Zusammenfassung</div>
        {toks.map((tk, i) => {
          let cls = 'word';
          if (fertig) {
            // Gefunden: die ganze dazugedichtete Stelle grün; übersehen: rot
            if (imFalsch(i)) cls += ok ? ' res-richtig' : ' res-fehlt';
            else if (mark.has(i)) cls += ' res-zuviel';
          } else if (mark.has(i)) cls += ' marked';
          return (
            <span key={i}>
              <button
                type="button"
                className={cls}
                aria-pressed={mark.has(i)}
                disabled={fertig}
                data-wort={i}
                onClick={() => {
                  const m = new Set(mark);
                  if (m.has(i)) m.delete(i);
                  else m.add(i);
                  setMark(m);
                }}
              >
                {typo(tk.w)}
              </button>{' '}
            </span>
          );
        })}
      </div>
      {!fertig ? (
        <div className="actions">
          <button
            className="btn primary"
            disabled={!mark.size}
            onClick={() => {
              setFertig(true);
              onResult(ok, [{ kat: 'dazugedichtet', ok }]);
            }}
          >
            Prüfen
          </button>
        </div>
      ) : (
        <Rueckmeldung ok={ok} kopf={ok ? 'Gefunden' : `Dazugedichtet ist: „${x.falsch}“`} onWeiter={onWeiter} letzte={letzte}>
          <Block label="Was im Text steht">
            <p className="fb-reason">{typo(x.grund)}</p>
          </Block>
        </Rueckmeldung>
      )}
    </div>
  );
}

function SynonymU({ t, n, onResult, onWeiter, letzte }: UProps) {
  const x = t.synonyme[n];
  const satz = t.absaetze.flat().find((s) => s.toLowerCase().includes(x.original.toLowerCase())) ?? x.original;
  const i0 = satz.toLowerCase().indexOf(x.original.toLowerCase());
  const [wahl, setWahl] = useState<number | null>(null);
  const richtig = x.gleich ? 0 : 1;
  return (
    <div>
      <Anweisung>Bedeutet das Ersatzwort genau dasselbe wie das Original?</Anweisung>
      <div className="source-box">
        <div className="eyebrow">Im Text „{typo(t.titel)}“</div>
        {i0 >= 0 ? (
          <>
            {typo(satz.slice(0, i0))}
            <mark className="zs-mark">{typo(satz.slice(i0, i0 + x.original.length))}</mark>
            {typo(satz.slice(i0 + x.original.length))}
          </>
        ) : (
          typo(satz)
        )}
      </div>
      <p className="zs-lueckensatz">
        „{typo(x.original)}“ ersetzt durch „<strong>{typo(x.ersatz)}</strong>“
      </p>
      <Optionen
        optionen={['Ja, genau gleichbedeutend', 'Nein, die Bedeutung verschiebt sich']}
        gewaehlt={wahl}
        richtig={[richtig]}
        onWahl={(i) => {
          if (wahl !== null) return;
          setWahl(i);
          onResult(i === richtig, [{ kat: 'dazugedichtet', ok: i === richtig }]);
        }}
        label="Bedeutungsgleich"
        data="syn"
      />
      {wahl !== null ? (
        <Rueckmeldung ok={wahl === richtig} kopf={x.gleich ? 'Gleichbedeutend' : 'Nicht gleichbedeutend'} onWeiter={onWeiter} letzte={letzte}>
          <Block label="Begründung">
            <p className="fb-reason">{typo(x.grund)}</p>
          </Block>
        </Rueckmeldung>
      ) : null}
    </div>
  );
}

function KonjunktivU({ t, n, onResult, onWeiter, letzte }: UProps) {
  const x = t.konjunktiv[n];
  const [eingabe, setEingabe] = useState('');
  const [phase, setPhase] = useState<'tippen' | 'regel' | 'fertig'>('tippen');
  const [formOk, setFormOk] = useState(false);
  const [uebersteuert, setUebersteuert] = useState(false);
  const [regel, setRegel] = useState<number | null>(null);
  const richtigeRegel = REGELN.findIndex((r) => r.id === x.regel);
  const pruefen = () => {
    if (!eingabe.trim()) return;
    setFormOk(evalTyped(eingabe, x.loesungen).richtig);
    setPhase('regel');
  };
  const fo = formOk || uebersteuert;
  return (
    <div>
      <Anweisung>Bring den Satz in indirekte Rede, ohne „dass“. Tippe nur den Teil nach der Redeeinleitung.</Anweisung>
      <div className="source-box">
        <div className="eyebrow">Im Text „{typo(t.titel)}“</div>
        {typo(x.vorlage)}
      </div>
      <div className="zs-rahmen">
        <span className="zs-rahmen-text">{typo(x.rahmen)}</span>
        <input
          className="input read"
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          readOnly={phase !== 'tippen'}
          aria-label="Indirekte Rede"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              pruefen();
            }
          }}
          autoFocus
          {...NO_AUTOCORRECT}
        />
      </div>
      {phase === 'tippen' ? (
        <div className="actions">
          <button className="btn primary" onClick={pruefen} disabled={!eingabe.trim()}>
            Prüfen <span className="kbd">↵</span>
          </button>
        </div>
      ) : (
        <>
          <div className={`notice ${fo ? 'info' : 'error'}`} style={{ marginTop: 12 }} data-form={fo ? 'ok' : 'falsch'}>
            <Icon name={fo ? 'checkCircle' : 'alert'} />
            <span className="grow">{fo ? 'Die Form stimmt.' : `Erwartet: ${typo(`${x.rahmen} ${x.loesungen[0]}`)}`}</span>
            {!fo && phase === 'regel' ? (
              <button className="btn small ghost" onClick={() => setUebersteuert(true)} title="Nur wählen, wenn deine Fassung ebenfalls korrekt ist">
                Meine Fassung ist auch richtig
              </button>
            ) : null}
          </div>
          <p className="task-instruction" style={{ marginTop: 18 }}>
            Und warum steht diese Form?
          </p>
          <Optionen
            optionen={REGELN.map((r) => r.text)}
            gewaehlt={regel}
            richtig={[richtigeRegel]}
            onWahl={(i) => {
              if (regel !== null) return;
              setRegel(i);
              setPhase('fertig');
              onResult(fo && i === richtigeRegel, [
                { kat: 'numerus', ok: fo },
                { kat: 'modus', ok: i === richtigeRegel },
              ]);
            }}
            label="Regeln"
            data="regel"
          />
        </>
      )}
      {phase === 'fertig' ? (
        <Rueckmeldung ok={fo && regel === richtigeRegel} kopf={fo && regel === richtigeRegel ? 'Form und Begründung richtig' : fo ? 'Form richtig, Begründung falsch' : 'Form falsch'} onWeiter={onWeiter} letzte={letzte}>
          <Block label="Richtig">
            {x.loesungen.map((l) => (
              <p key={l} className="fb-solution">
                {typo(`${x.rahmen} ${l}`)}
              </p>
            ))}
          </Block>
          <Block label="Begründung">
            <p className="fb-reason">{typo(x.grund)}</p>
          </Block>
        </Rueckmeldung>
      ) : null}
    </div>
  );
}

function VerdichtenU({ t, n, onResult, onWeiter, letzte }: UProps) {
  const k = verdichtbar(t)[n] ?? 0;
  const a = t.abschnitte[k];
  const [eigen, setEigen] = useState('');
  const [phase, setPhase] = useState<'schreiben' | 'pruefen' | 'fertig'>('schreiben');
  const [ok, setOk] = useState(false);
  const zahl = woerter(eigen);
  const hinweise = useMemo(() => (phase === 'schreiben' ? [] : hinweiseSatz(eigen, t, a.schluessel, 30, 1)), [phase, eigen, t, a]);
  const abgeben = () => {
    if (zahl < 4) return;
    setPhase('pruefen');
  };
  return (
    <div>
      <Anweisung>Fass den Abschnitt in einem Satz zusammen, höchstens 30 Wörter, mit Funktionsverb.</Anweisung>
      <AbschnittAnzeige t={t} k={k} />
      <div className="answer-area" style={{ marginTop: 16 }}>
        <textarea
          className="textarea read"
          rows={3}
          value={eigen}
          onChange={(e) => setEigen(e.target.value)}
          readOnly={phase !== 'schreiben'}
          aria-label="Dein Satz"
          placeholder="Der Autor … , dass …"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              abgeben();
            }
          }}
          autoFocus
          {...NO_AUTOCORRECT}
        />
        <div className="row between wrap" style={{ marginTop: 8, gap: 8 }}>
          <WortZaehler n={zahl} max={30} />
          {phase === 'schreiben' ? (
            <button className="btn primary" onClick={abgeben} disabled={zahl < 4}>
              Vergleichen <span className="kbd">↵</span>
            </button>
          ) : null}
        </div>
      </div>
      {phase !== 'schreiben' ? (
        <div className="card zs-auswertung" style={{ marginTop: 20 }}>
          <Block label="Musterlösung">
            <p className="fb-solution">{typo(a.muster)}</p>
          </Block>
          <Block label="Hinweise">
            <HinweisListe hinweise={hinweise} leer="Keine Auffälligkeiten gefunden. Vergleiche trotzdem genau mit der Musterlösung." />
          </Block>
          {phase === 'pruefen' ? (
            <JaNein
              fragen={[
                { id: 'kern', frage: 'Gibt dein Satz den Kern des Abschnitts wieder, nicht nur ein Beispiel?' },
                { id: 'dazu', frage: 'Steht alles in deinem Satz auch im Text (nichts dazugedichtet)?' },
              ]}
              onFertig={(x) => {
                const fallen = hinweise.some((h) => h.kat === 'dazugedichtet');
                const r = x.kern && x.dazu && !fallen && zahl <= 30;
                setOk(r);
                setPhase('fertig');
                onResult(r, [
                  { kat: 'beispiel', ok: x.kern },
                  { kat: 'dazugedichtet', ok: x.dazu && !fallen },
                  { kat: 'laenge', ok: zahl <= 30 },
                ]);
              }}
            />
          ) : null}
        </div>
      ) : null}
      {phase === 'fertig' ? <Rueckmeldung ok={ok} kopf={ok ? 'Gut verdichtet' : 'Noch nicht der Kern in einem knappen Satz'} onWeiter={onWeiter} letzte={letzte} /> : null}
    </div>
  );
}

// ---------- Schluss ----------

function SchlussWaehlenU({ t, onResult, onWeiter, letzte }: UProps) {
  const opts = useMemo(() => schlussOptionen(t), [t]);
  const [wahl, setWahl] = useState<number | null>(null);
  const richtig = opts.findIndex((o) => o.art === 'richtig');
  const gewaehlt = wahl !== null ? opts[wahl] : undefined;
  return (
    <div>
      <Anweisung>Welcher Schlusssatz gibt die Gesamtaussage des Textes wieder?</Anweisung>
      <TextAnzeige t={t} einklappbar />
      <div style={{ marginTop: 16 }}>
        <Optionen
          optionen={opts.map((o) => o.satz)}
          gewaehlt={wahl}
          richtig={[richtig]}
          onWahl={(i) => {
            if (wahl !== null) return;
            setWahl(i);
            const o = opts[i];
            const kats: Kats = o.art === 'richtig' ? [{ kat: 'beispiel', ok: true }, { kat: 'dazugedichtet', ok: true }] : [{ kat: o.art === 'teilaspekt' ? 'beispiel' : 'dazugedichtet', ok: false }];
            onResult(i === richtig, kats);
          }}
          label="Schlusssätze"
          data="schluss"
        />
      </div>
      {gewaehlt ? (
        <Rueckmeldung
          ok={wahl === richtig}
          kopf={wahl === richtig ? 'Richtig' : gewaehlt.art === 'teilaspekt' ? 'Nur ein Teilaspekt' : gewaehlt.art === 'wertung' ? 'Das ist eine Wertung' : 'Dazugedichtet'}
          onWeiter={onWeiter}
          letzte={letzte}
        >
          {gewaehlt.grund ? (
            <Block label="Begründung">
              <p className="fb-reason">{typo(gewaehlt.grund)}</p>
            </Block>
          ) : null}
          <Block label="Gesamtaussage">
            <p className="fb-solution">{typo(t.schluss)}</p>
          </Block>
        </Rueckmeldung>
      ) : null}
    </div>
  );
}

function SchlussSchreibenU({ t, onResult, onWeiter, letzte }: UProps) {
  const [eigen, setEigen] = useState('');
  const [phase, setPhase] = useState<'schreiben' | 'pruefen' | 'fertig'>('schreiben');
  const [ok, setOk] = useState(false);
  const hinweise = useMemo(() => (phase === 'schreiben' ? [] : hinweiseSatz(eigen, t, t.schluessel, undefined, 2)), [phase, eigen, t]);
  const abgeben = () => {
    if (woerter(eigen) < 5) return;
    setPhase('pruefen');
  };
  return (
    <div>
      <Anweisung>Schreib den Schluss: die Gesamtaussage des Textes in ein bis zwei Sätzen.</Anweisung>
      <TextAnzeige t={t} einklappbar />
      <div className="answer-area" style={{ marginTop: 16 }}>
        <textarea
          className="textarea read"
          rows={3}
          value={eigen}
          onChange={(e) => setEigen(e.target.value)}
          readOnly={phase !== 'schreiben'}
          aria-label="Dein Schluss"
          placeholder="Insgesamt …"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              abgeben();
            }
          }}
          autoFocus
          {...NO_AUTOCORRECT}
        />
        <div className="row between wrap" style={{ marginTop: 8, gap: 8 }}>
          <WortZaehler n={woerter(eigen)} />
          {phase === 'schreiben' ? (
            <button className="btn primary" onClick={abgeben} disabled={woerter(eigen) < 5}>
              Vergleichen <span className="kbd">↵</span>
            </button>
          ) : null}
        </div>
      </div>
      {phase !== 'schreiben' ? (
        <div className="card zs-auswertung" style={{ marginTop: 20 }}>
          <Block label="Musterlösung">
            <p className="fb-solution">{typo(t.schluss)}</p>
          </Block>
          <Block label="Hinweise">
            <HinweisListe hinweise={hinweise} leer="Keine Auffälligkeiten gefunden." />
          </Block>
          {phase === 'pruefen' ? (
            <JaNein
              fragen={[
                { id: 'gesamt', frage: 'Trifft dein Schluss die Gesamtaussage des ganzen Textes, nicht nur einen Teil?' },
                { id: 'neu', frage: 'Ohne neue Inhalte und ohne eigene Wertung?' },
              ]}
              onFertig={(x) => {
                const dazu = hinweise.some((h) => h.kat === 'dazugedichtet');
                const r = x.gesamt && x.neu && !dazu;
                setOk(r);
                setPhase('fertig');
                onResult(r, [
                  { kat: 'beispiel', ok: x.gesamt },
                  { kat: 'dazugedichtet', ok: x.neu && !dazu },
                ]);
              }}
            />
          ) : null}
        </div>
      ) : null}
      {phase === 'fertig' ? <Rueckmeldung ok={ok} kopf={ok ? 'Gesamtaussage getroffen' : 'Noch nicht die Gesamtaussage'} onWeiter={onWeiter} letzte={letzte} /> : null}
    </div>
  );
}

const KOMPONENTEN: Record<ZArt, (p: UProps) => React.JSX.Element> = {
  textsorte: TextsorteU,
  einleitungPruefen: EinleitungPruefenU,
  einleitungSchreiben: EinleitungSchreibenU,
  struktur: StrukturU,
  these: TheseU,
  kernBeispiel: KernBeispielU,
  funktionsverb: FunktionsverbU,
  fingertest: FingertestU,
  synonym: SynonymU,
  konjunktiv: KonjunktivU,
  verdichten: VerdichtenU,
  schlussWaehlen: SchlussWaehlenU,
  schlussSchreiben: SchlussSchreibenU,
};

// ---------- Übungsansicht ----------

export function ZUebungsansicht() {
  const data = useApp();
  const s = data.zusammenfassen;
  const sitz = s.sitzung;
  const [beantwortet, setBeantwortet] = useState<{ index: number; letzte: boolean } | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const sitzId = sitz?.id;
  useEffect(() => setBeantwortet(null), [sitzId]);

  const index = beantwortet?.index ?? sitz?.index ?? 0;
  const item = sitz?.items[index];
  const t = item ? textVon(item.textId) : undefined;

  const onResult = useCallback(
    (richtig: boolean, kats: Kats) => {
      if (!sitz || !item || beantwortet) return;
      setBeantwortet({ index: sitz.index, letzte: sitz.index + 1 >= sitz.items.length });
      void ergebnisSpeichern(item, richtig, kats);
    },
    [sitz, item, beantwortet],
  );

  const weiter = useCallback(async () => {
    if (!beantwortet) return;
    if (beantwortet.letzte) await sitzungBeenden();
    setBeantwortet(null);
    window.scrollTo(0, 0);
  }, [beantwortet]);

  // Enter geht nach der Rückmeldung weiter (außer in Eingabefeldern und auf Knöpfen)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.defaultPrevented || !beantwortet || confirmEnd) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      e.preventDefault();
      void weiter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [beantwortet, weiter, confirmEnd]);

  if (!sitz && !beantwortet) {
    if (s.letzte) return <Ergebnis />;
    return (
      <div className="practice">
        <main className="practice-body">
          <Empty icon="text" title="Keine laufende Übung" action={<a className="btn primary" href="#/zusammenfassen">Zur Übersicht</a>}>
            Starte in „Zusammenfassen“ eine Übung.
          </Empty>
        </main>
      </div>
    );
  }

  const total = sitz?.items.length ?? 1;
  const done = sitz?.ergebnisse.length ?? total;
  const K = item ? KOMPONENTEN[item.art] : null;

  return (
    <div className="practice zs-uebung">
      <header className="practice-head">
        <div className="practice-head-inner">
          <button className="btn icon small ghost" onClick={() => setConfirmEnd(true)} aria-label="Übung beenden" title="Übung beenden">
            <Icon name="close" />
          </button>
          <Progress value={done / total} label="Fortschritt" />
          <span className="count">
            {Math.min(done + (beantwortet ? 0 : 1), total)} / {total}
          </span>
        </div>
      </header>
      <main className="practice-body">
        {item && t && K ? (
          <>
            <div className="task-meta">
              <span>{sitz?.titel === artDef(item.art).titel ? sitz?.titel : `${sitz?.titel} · ${artDef(item.art).titel}`}</span>
              <span className="badge outline">Stufe {t.stufe}</span>
            </div>
            <div data-task={`${item.art}:${item.textId}:${item.n}`}>
              <K key={`${sitz?.id}-${index}`} t={t} n={item.n} onResult={onResult} onWeiter={() => void weiter()} letzte={!!beantwortet?.letzte} />
            </div>
          </>
        ) : (
          <div className="loading">
            <div>
              <div className="spinner" />
              Wird geladen …
            </div>
          </div>
        )}
      </main>
      {confirmEnd ? (
        <Confirm
          title="Übung beenden?"
          text="Beantwortete Aufgaben bleiben gespeichert."
          confirmLabel="Beenden"
          onCancel={() => setConfirmEnd(false)}
          onConfirm={async () => {
            const z = sitz?.zurueck ?? '/zusammenfassen';
            setConfirmEnd(false);
            await sitzungAbbrechen();
            navigate(z);
          }}
        />
      ) : null}
    </div>
  );
}

function Ergebnis() {
  const data = useApp();
  const l = data.zusammenfassen.letzte!;
  const richtig = l.ergebnisse.filter((e) => e.richtig).length;
  const jeArt = new Map<ZArt, { r: number; g: number }>();
  for (const e of l.ergebnisse) {
    const x = jeArt.get(e.art) ?? { r: 0, g: 0 };
    x.g++;
    if (e.richtig) x.r++;
    jeArt.set(e.art, x);
  }
  return (
    <div className="practice">
      <main className="practice-body summary">
        <div className="eyebrow">{l.titel}</div>
        <h1 style={{ marginTop: 6 }}>Übung abgeschlossen</h1>
        <div className="card" style={{ marginTop: 24 }}>
          <div className="stat">
            <span className="value">
              {richtig} von {l.ergebnisse.length}
            </span>
            <span className="label">richtig</span>
          </div>
        </div>
        <div className="section">
          <div className="list">
            {[...jeArt.entries()].map(([a, x]) => (
              <div key={a} className="list-item">
                <span className="grow">
                  <span className="title-line">{artDef(a).titel}</span>
                  <span className="sub-line">
                    {x.r} von {x.g} richtig
                  </span>
                </span>
                {x.r === x.g ? <Icon name="checkCircle" className="ok-ink" /> : <Icon name="alert" className="muted" />}
              </div>
            ))}
          </div>
        </div>
        <div className="actions" style={{ marginTop: 28, justifyContent: 'flex-start' }}>
          <button className="btn primary" autoFocus onClick={() => void starteSitzung({ titel: l.titel, zurueck: l.zurueck, arten: l.arten, n: l.items.length })}>
            Noch eine Runde
          </button>
          <a className="btn" href={`#${l.zurueck}`}>
            Zurück
          </a>
        </div>
      </main>
    </div>
  );
}
