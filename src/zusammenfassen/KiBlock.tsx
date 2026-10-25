// KI-Bewertung eines eigenen Textes (Einleitung, Abschnitt, Schluss oder ganze Zusammenfassung).

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { typo } from '../lib/normalize';
import { useApp } from '../lib/store';
import { quellenzeile } from './daten';
import { kiBereit, kiBewerten, type KiAnfrage, type KiBewertung } from './ki';
import type { ZText } from './typen';

/** Textangaben für die KI: Quellenzeile und Textsorte. */
export function kiAngaben(t: ZText): string {
  return `${quellenzeile(t)} Textsorte: ${t.textsorte}.`;
}

/** Gespeicherte Bewertung lesen; ältere Stände speicherten nur die Fehlerliste. */
export function kiGespeichertLesen(s?: string): KiBewertung | null {
  if (!s) return null;
  try {
    const j = JSON.parse(s) as unknown;
    if (Array.isArray(j)) return { kriterien: [], fehler: j as KiBewertung['fehler'], gesamt: '', tipp: '' };
    const b = j as Partial<KiBewertung>;
    return { kriterien: b.kriterien ?? [], fehler: b.fehler ?? [], gesamt: b.gesamt ?? '', tipp: b.tipp ?? '' };
  } catch {
    return null;
  }
}

export function KiBlock({ anfrage, gespeichert, onBewertet }: { anfrage: KiAnfrage; gespeichert?: string; onBewertet?: (json: string) => void }) {
  const ki = useApp().zusammenfassen.ki;
  const vorher = kiGespeichertLesen(gespeichert);
  const [status, setStatus] = useState<'aus' | 'laeuft' | 'fertig' | 'fehler'>(vorher ? 'fertig' : 'aus');
  const [b, setB] = useState<KiBewertung | null>(vorher);
  const [meldung, setMeldung] = useState('');
  const abbruch = useRef<AbortController | null>(null);
  useEffect(() => () => abbruch.current?.abort(), []);

  if (!kiBereit(ki)) {
    return (
      <p className="small muted zs-ki-aus" data-ki="aus">
        <Icon name="info" /> KI-Bewertung: unter <a href="#/zusammenfassen/ki">Zusammenfassen → KI</a> einrichten.
      </p>
    );
  }

  const holen = async () => {
    abbruch.current?.abort();
    const c = new AbortController();
    abbruch.current = c;
    setStatus('laeuft');
    try {
      const r = await kiBewerten(ki, anfrage, c.signal);
      if (c.signal.aborted) return;
      const { roh: _roh, ...rest } = r;
      setB(rest);
      setStatus('fertig');
      onBewertet?.(JSON.stringify(rest));
    } catch (e) {
      if (c.signal.aborted) return;
      setMeldung(e instanceof Error ? e.message : String(e));
      setStatus('fehler');
    }
  };

  return (
    <div className="zs-ki" data-ki={status}>
      <div className="row between wrap" style={{ gap: 8 }}>
        <div className="fb-label" style={{ margin: 0 }}>
          KI-Bewertung ({ki.anbieter === 'claude' ? 'Claude' : 'lokal'}, kann irren)
        </div>
        <button className="btn small" onClick={() => void holen()} disabled={status === 'laeuft'} data-ki-knopf>
          {status === 'laeuft' ? 'Die KI liest …' : status === 'fertig' ? 'Erneut bewerten' : 'KI bewerten lassen'}
        </button>
      </div>
      {status === 'fehler' ? (
        <p className="small bad-ink" style={{ marginTop: 10 }}>
          {meldung}
        </p>
      ) : null}
      {status === 'fertig' && b ? (
        <div className="zs-ki-ergebnis" style={{ marginTop: 10 }}>
          {b.gesamt ? <p className="zs-ki-gesamt">{typo(b.gesamt)}</p> : null}
          {b.kriterien.length ? (
            <ul className="result-list" data-ki-kriterien={b.kriterien.length}>
              {b.kriterien.map((k, i) => (
                <li key={i} className={k.erfuellt ? 'ok' : 'bad'}>
                  <Icon name={k.erfuellt ? 'checkCircle' : 'crossCircle'} />
                  <div>
                    {typo(k.kriterium)}
                    {k.begruendung ? <div className="small muted">{typo(k.begruendung)}</div> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {b.fehler.length ? (
            <>
              <div className="fb-label" style={{ marginTop: 12 }}>
                Fehler im Einzelnen
              </div>
              <ul className="result-list" data-ki-fehler={b.fehler.length}>
                {b.fehler.map((f, i) => (
                  <li key={i} className="bad">
                    <Icon name="alert" />
                    <div>
                      {f.kategorie ? <strong>{f.kategorie}: </strong> : null}
                      {typo(f.art)}
                      {f.stelle ? <span className="small muted"> · „{f.stelle}“</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="small muted" style={{ marginTop: 8 }}>
              Die KI hat keine einzelnen Fehler gemeldet.
            </p>
          )}
          {b.tipp ? (
            <p className="fb-note" style={{ marginTop: 10 }}>
              <Icon name="target" />
              <span>
                <strong>Nächster Schritt:</strong> {typo(b.tipp)}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
