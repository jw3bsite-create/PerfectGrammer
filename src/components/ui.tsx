import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { LEVEL_LABEL } from '../lib/mastery';
import type { Level, Regelkarte } from '../lib/types';
import { typo } from '../lib/normalize';

export function LevelBadge({ level }: { level: Level }) {
  const icon = level === 'gemeistert' ? 'checkCircle' : level === 'sicher' ? 'check' : level === 'inArbeit' ? 'edit' : 'dot';
  return (
    <span className={`badge ${level}`}>
      <Icon name={icon} />
      {LEVEL_LABEL[level]}
    </span>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ icon = 'info', title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function Sheet({ title, eyebrow, onClose, children, labelledBy = 'sheet-title' }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} ref={ref}>
        <div className="sheet-head">
          <div>
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            <h2 id={labelledBy}>{title}</h2>
          </div>
          <button className="btn icon small ghost" onClick={onClose} aria-label="Schließen">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({
  title,
  text,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet title={title} onClose={onCancel} labelledBy="confirm-title">
      <p className="muted">{text}</p>
      <div className="actions">
        <button className="btn" onClick={onCancel}>
          Abbrechen
        </button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} autoFocus>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

export function RuleCard({ karte }: { karte: Regelkarte }) {
  return (
    <div className="rule">
      <p className="rule-text">{typo(karte.regel)}</p>
      <div className="rule-probe">
        <div className="eyebrow">Probe</div>
        <p>{typo(karte.probe)}</p>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Beispiele
        </div>
        <ul className="rule-examples">
          {karte.beispiele.map((b, i) => (
            <li key={i}>{typo(b)}</li>
          ))}
        </ul>
      </div>
      <div className="rule-trap">
        <Icon name="alert" />
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Typische Falle
          </div>
          <p>{typo(karte.falle)}</p>
        </div>
      </div>
    </div>
  );
}

let toastTimer: number | undefined;
type ToastListener = (msg: string | null) => void;
const toastListeners = new Set<ToastListener>();

export function toast(msg: string) {
  for (const l of toastListeners) l(msg);
  window.clearTimeout(toastTimer);
  // Längere Meldungen bleiben länger stehen, damit sie in Ruhe gelesen werden können.
  toastTimer = window.setTimeout(() => {
    for (const l of toastListeners) l(null);
  }, Math.max(3200, msg.length * 60));
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastListeners.add(setMsg);
    return () => {
      toastListeners.delete(setMsg);
    };
  }, []);
  if (!msg) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {msg}
    </div>
  );
}

export function pct(n: number, d: number): string {
  if (!d) return '–';
  return `${Math.round((n / d) * 100)}\u202f%`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function numberWord(n: number): string {
  const w = ['null', 'eine', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf'];
  return n >= 0 && n < w.length ? w[n] : String(n);
}
