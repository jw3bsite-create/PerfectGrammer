// Bausteine des Moduls „Zusammenfassen“.

import { useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { typo } from '../lib/normalize';
import { quellenzeile } from './daten';
import type { Hinweis } from './pruefen';
import type { ZText } from './typen';

/** Der Übungstext mit Absätzen; Sätze optional antippbar. */
export function TextAnzeige({
  t,
  von = 0,
  bis,
  satzKlick,
  satzKlasse,
  quelle = true,
  einklappbar = false,
  titel = true,
}: {
  t: ZText;
  von?: number;
  bis?: number;
  satzKlick?: (absatz: number, satz: number) => void;
  satzKlasse?: (absatz: number, satz: number) => string | undefined;
  quelle?: boolean;
  einklappbar?: boolean;
  titel?: boolean;
}) {
  const ende = bis ?? t.absaetze.length - 1;
  const inhalt = (
    <div className="zs-text" data-text={t.id}>
      {titel && von === 0 ? <h3 className="zs-titel">{typo(t.titel)}</h3> : null}
      {t.absaetze.slice(von, ende + 1).map((abs, i) => {
        const a = von + i;
        return (
          <p key={a} className="zs-absatz">
            {abs.map((s, j) =>
              satzKlick ? (
                <button key={j} type="button" className={`zs-satz ${satzKlasse?.(a, j) ?? ''}`} data-satz={`${a}-${j}`} onClick={() => satzKlick(a, j)}>
                  {typo(s)}
                </button>
              ) : (
                <span key={j}>{typo(s)} </span>
              ),
            )}
          </p>
        );
      })}
      {quelle ? <p className="zs-quelle">Quelle: {typo(quellenzeile(t))}</p> : null}
    </div>
  );
  if (!einklappbar) return inhalt;
  return (
    <details className="zs-details" open>
      <summary>Text „{typo(t.titel)}“</summary>
      {inhalt}
    </details>
  );
}

export function Rueckmeldung({ ok, kopf, children, onWeiter, letzte }: { ok: boolean; kopf?: string; children?: ReactNode; onWeiter: () => void; letzte: boolean }) {
  return (
    <div className={`feedback ${ok ? 'ok' : 'bad'}`} role="region" aria-label="Rückmeldung">
      <div className="feedback-head">
        <Icon name={ok ? 'checkCircle' : 'crossCircle'} />
        {kopf ?? (ok ? 'Richtig' : 'Nicht ganz')}
      </div>
      <div className="feedback-body">
        {children}
        <div className="actions" style={{ marginTop: 4 }}>
          <button className="btn primary" onClick={onWeiter} autoFocus>
            {letzte ? 'Abschließen' : 'Weiter'} <span className="kbd">↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="fb-label">{label}</div>
      {children}
    </div>
  );
}

export function HinweisListe({ hinweise, leer }: { hinweise: Hinweis[]; leer?: string }) {
  if (!hinweise.length) return leer ? <p className="small muted">{leer}</p> : null;
  return (
    <ul className="result-list" data-hinweise={hinweise.length}>
      {hinweise.map((h, i) => (
        <li key={i} className="bad">
          <Icon name="alert" />
          <div>
            {typo(h.text)}
            {h.stellen?.length ? <span className="small muted"> · {h.stellen.map((x) => `„${x}“`).join(', ')}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PunktListe({ teile }: { teile: { label: string; ok: boolean }[] }) {
  return (
    <ul className="result-list">
      {teile.map((x) => (
        <li key={x.label} className={x.ok ? 'ok' : 'bad'}>
          <Icon name={x.ok ? 'checkCircle' : 'crossCircle'} />
          <div>
            {typo(x.label)}
            <span className="sr-only">{x.ok ? ': erfüllt' : ': fehlt'}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Ja/Nein-Fragen zur Selbstprüfung. */
export function JaNein({
  fragen,
  onFertig,
  knopf = 'Auswerten',
  hinweise,
}: {
  fragen: { id: string; frage: string }[];
  onFertig: (antworten: Record<string, boolean>) => void;
  knopf?: string;
  hinweise?: Record<string, ReactNode>;
}) {
  const [a, setA] = useState<Record<string, boolean>>({});
  const fertig = fragen.every((f) => f.id in a);
  return (
    <div className="zs-janein" role="group" aria-label="Selbstprüfung">
      {fragen.map((f) => (
        <div key={f.id} className="zs-frage" data-frage={f.id}>
          <div className="zs-frage-text">
            {typo(f.frage)}
            {hinweise?.[f.id] ? <div className="zs-auto">{hinweise[f.id]}</div> : null}
          </div>
          <div className="segmented" role="group" aria-label={f.frage}>
            <button type="button" aria-pressed={a[f.id] === true} onClick={() => setA({ ...a, [f.id]: true })}>
              Ja
            </button>
            <button type="button" aria-pressed={a[f.id] === false} onClick={() => setA({ ...a, [f.id]: false })}>
              Nein
            </button>
          </div>
        </div>
      ))}
      <div className="actions">
        <button className="btn primary" disabled={!fertig} onClick={() => onFertig(a)}>
          {knopf}
        </button>
      </div>
    </div>
  );
}

export function WortZaehler({ n, max, ziel }: { n: number; max?: number; ziel?: number }) {
  const zuViel = (max && n > max) || (ziel && n > ziel * 1.35);
  return (
    <span className={`zs-zaehler${zuViel ? ' bad' : ''}`} aria-live="polite">
      {n} {n === 1 ? 'Wort' : 'Wörter'}
      {max ? ` von höchstens ${max}` : ''}
      {ziel ? ` · Musterlösung etwa ${ziel}` : ''}
    </span>
  );
}
