import { useEffect, useRef, type ReactNode } from 'react';
import type { DiffOp } from '../lib/diff';
import type { ParsedKomma } from '../lib/markup';
import type { EntryDraft } from '../lib/store';
import type { Task, Teilergebnis } from '../lib/types';
import { typo } from '../lib/normalize';

export interface ExerciseResult {
  richtig: boolean;
  antwort: string;
  loesung: string;
  teile?: Teilergebnis[];
  eintraege?: EntryDraft[];
  fehlertypOverride?: string;
  /** Darf der Nutzer die Wertung übersteuern („Als richtig werten“)? */
  uebersteuerbar?: boolean;
  hinweise?: string[];
  detail?: ReactNode;
  /** Teilweise richtig (Textwiedergabe, Korrekturtext). */
  teilweise?: boolean;
  /** Eigene Begründung statt der Aufgabenbegründung. */
  begruendung?: string;
}

export interface ExerciseProps {
  task: Task;
  modus?: 'fehlertyp';
  guided: boolean;
  locked: boolean;
  /** Eigene Arbeitsanweisung (etwa für die Fehlerjagd im Modul „Meine Schwächen“). */
  anweisung?: string;
  /** Registriert die Hauptaktion (Enter, Zeitablauf). */
  register: (fn: (() => void) | null) => void;
  onResult: (r: ExerciseResult) => void;
}

/** Ist der Fokus in einem Eingabefeld? Dann gehören Tasten dem Feld. */
export function typingTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Tastaturkürzel einer Übung; aktiv, solange enabled gilt. */
export function useKeys(enabled: boolean, handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const fn = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      ref.current(e);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [enabled]);
}

export function DiffView({ ops }: { ops: DiffOp<string>[] }) {
  return (
    <span className="diff" aria-label="Abweichung Zeichen für Zeichen">
      {ops.map((o, i) => {
        const text = o.items.join('');
        if (o.op === 'gleich') return <span key={i}>{text}</span>;
        const shown = text.replace(/ /g, '␣');
        return (
          <span key={i} className={o.op} title={o.op === 'fehlt' ? 'fehlt in deiner Antwort' : 'zu viel in deiner Antwort'}>
            <span className="sr-only">{o.op === 'fehlt' ? ' fehlt: ' : ' zu viel: '}</span>
            {shown}
          </span>
        );
      })}
    </span>
  );
}

/** Lösungssatz einer Kommaaufgabe; freigestellte Kommas markiert, gebeugte Verben auf Wunsch unterstrichen. */
export function KommaSolution({ p, verbs }: { p: ParsedKomma; verbs?: boolean }) {
  return (
    <span className="fb-solution">
      {p.tokens.map((t, i) => {
        const g = p.gaps[i];
        return (
          <span key={i}>
            <span className={verbs && t.verb ? 'u-verb' : undefined}>{typo(t.text)}</span>
            {g === 'ja' ? ',' : g === 'frei' ? (
              <span className="mark-frei" title="freigestellt">
                (,)<span className="sr-only"> freigestellt</span>
              </span>
            ) : null}
            {i < p.tokens.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </span>
  );
}

export function FbBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="fb-label">{label}</div>
      {children}
    </div>
  );
}

export function splitGap(text: string): [string, string] {
  const i = text.indexOf('___');
  if (i < 0) return [text, ''];
  return [text.slice(0, i), text.slice(i + 3)];
}

/** Eingabefelder ohne Autokorrektur – sonst korrigiert das Gerät die Fehler des Nutzers. */
export const NO_AUTOCORRECT = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
} as const;
