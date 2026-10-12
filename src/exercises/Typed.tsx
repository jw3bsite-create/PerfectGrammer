import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { evalTyped, missingForms, type TypedEval } from '../lib/evaluate';
import { typo } from '../lib/normalize';
import { speak, speechAvailable } from '../lib/speech';
import { getState } from '../lib/store';
import type { EintippenTask, EntscheidenTask, UmformenTask, WortTask } from '../lib/types';
import { DiffView, FbBlock, NO_AUTOCORRECT, splitGap, typingTarget, useKeys, type ExerciseProps } from './common';

function typedDetail(ev: TypedEval, full?: (s: string) => string) {
  if (ev.richtig) {
    return ev.variante ? (
      <FbBlock label="Lösung">
        <span className="fb-solution">{typo(full ? full(ev.loesung) : ev.loesung)}</span>
      </FbBlock>
    ) : null;
  }
  return (
    <>
      <FbBlock label="Deine Antwort, Zeichen für Zeichen">
        <DiffView ops={ev.diff} />
      </FbBlock>
      <FbBlock label="Richtig">
        <span className="fb-solution">{typo(full ? full(ev.loesung) : ev.loesung)}</span>
      </FbBlock>
    </>
  );
}

// ---------- Form eintippen ----------

export function EintippenExercise({ task, locked, register, onResult }: ExerciseProps & { task: EintippenTask }) {
  const [value, setValue] = useState('');
  const [ev, setEv] = useState<TypedEval | null>(null);
  const [before, after] = splitGap(task.text);
  const width = Math.max(5, ...task.loesungen.map((l) => l.length + 2));

  const submit = () => {
    if (locked) return;
    const r = evalTyped(value, task.loesungen);
    setEv(r);
    const hinweise: string[] = [];
    if (r.variante) hinweise.push('Deine Schreibung ist eine gültige Variante.');
    else if (r.richtig && task.loesungen.length > 1) hinweise.push(`Ebenso richtig: ${task.loesungen.filter((l) => l !== r.loesung).join(', ')}.`);
    onResult({
      richtig: r.richtig,
      antwort: `${before}${value}${after}`.trim(),
      loesung: `${before}${task.loesungen[0]}${after}`.trim(),
      hinweise,
      detail: typedDetail(r, (s) => `${before}${s}${after}`.trim()),
    });
  };
  useEffect(() => register(locked ? null : submit));

  return (
    <div>
      <p className="task-instruction">Tippe die richtige Form in die Lücke.</p>
      <p className="sentence">
        {typo(before)}
        {locked && ev ? (
          <span className={`gap-filled ${ev.richtig ? 'ok' : 'bad'}`}>{value || '–'}</span>
        ) : (
          <input
            className="gap-input"
            style={{ width: `${width}ch` }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            aria-label={`Lücke${task.hinweis ? `, Grundform: ${task.hinweis}` : ''}`}
            autoFocus
            {...NO_AUTOCORRECT}
          />
        )}
        {task.hinweis ? <span className="hint-paren"> ({task.hinweis})</span> : null}
        {typo(after)}
      </p>
    </div>
  );
}

// ---------- Entscheiden ----------

export function EntscheidenExercise({ task, locked, register, onResult }: ExerciseProps & { task: EntscheidenTask }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [before, after] = splitGap(task.text);

  const choose = (i: number) => {
    if (locked || chosen !== null) return;
    setChosen(i);
    const opt = task.optionen[i];
    const richtig = task.loesungen.includes(opt);
    const hinweise: string[] = [];
    if (task.loesungen.length > 1) hinweise.push(`Beide Schreibungen gelten: ${task.loesungen.join(' und ')}.`);
    onResult({
      richtig,
      antwort: `${before}${opt}${after}`.trim(),
      loesung: `${before}${task.loesungen[0]}${after}`.trim(),
      hinweise,
      detail: richtig ? null : (
        <FbBlock label="Richtig">
          <span className="fb-solution">{typo(`${before}${task.loesungen[0]}${after}`.trim())}</span>
        </FbBlock>
      ),
    });
  };
  useEffect(() => register(null));

  useKeys(!locked && chosen === null, (e) => {
    if (typingTarget(e)) return;
    const n = Number(e.key);
    if (n >= 1 && n <= task.optionen.length) {
      e.preventDefault();
      choose(n - 1);
    }
  });

  const filled = chosen !== null ? task.loesungen[0] : null;
  const cols = task.optionen.length === 3 ? 'three' : 'two';
  return (
    <div>
      <p className="task-instruction">Wähle, was in die Lücke gehört.</p>
      <p className="sentence">
        {typo(before)}
        {filled ? <span className="gap-filled ok">{filled}</span> : <span className="gap-blank" aria-label="Lücke" />}
        {typo(after)}
      </p>
      <div className={`options ${cols}`} role="group" aria-label="Auswahl">
        {task.optionen.map((o, i) => {
          const isRight = task.loesungen.includes(o);
          let cls = 'option';
          let status: string | null = null;
          if (chosen !== null) {
            if (isRight) {
              cls += ' st-ok';
              status = 'richtig';
            } else if (chosen === i) {
              cls += ' st-bad';
              status = 'falsch';
            }
          }
          return (
            <button key={i} className={cls} onClick={() => choose(i)} disabled={chosen !== null} autoFocus={i === 0}>
              <span className="kbd">{i + 1}</span>
              <span>{o}</span>
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
    </div>
  );
}

// ---------- Umformen ----------

export function UmformenExercise({ task, locked, register, onResult }: ExerciseProps & { task: UmformenTask }) {
  const [value, setValue] = useState('');
  const submit = () => {
    if (locked) return;
    if (!value.trim()) return;
    const r = evalTyped(value, task.loesungen);
    const hinweise: string[] = [];
    if (!r.richtig && task.kern?.length) {
      const miss = missingForms(value, task.kern);
      if (miss.length) hinweise.push(`Erwartete Verbform: ${miss.map((m) => `„${m}“`).join(', ')}.`);
    }
    if (r.richtig && r.variante) hinweise.push('Deine Fassung ist eine gültige Variante.');
    const others = task.loesungen.filter((l) => l !== r.loesung);
    onResult({
      richtig: r.richtig,
      antwort: value.trim(),
      loesung: task.loesungen[0],
      hinweise,
      uebersteuerbar: !r.richtig,
      detail: (
        <>
          {typedDetail(r)}
          {others.length ? (
            <FbBlock label={r.richtig ? 'Ebenso richtig' : 'Ebenso richtig wäre'}>
              <div className="stack-sm">
                {others.map((o) => (
                  <span key={o} className="fb-solution">
                    {typo(o)}
                  </span>
                ))}
              </div>
            </FbBlock>
          ) : null}
        </>
      ),
    });
  };
  useEffect(() => register(locked ? null : submit));
  return (
    <div>
      <p className="task-instruction">{task.anweisung ?? 'Gib die Aussage in indirekter Rede wieder. Tippe den ganzen Satz.'}</p>
      <div className="source-box">{typo(task.vorlage)}</div>
      <div className="answer-area">
        <textarea
          className="textarea read"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          readOnly={locked}
          aria-label={task.anweisung ? 'Umgeformter Satz' : 'Indirekte Rede'}
          placeholder={task.anweisung ? 'Der ganze Satz' : 'Der ganze Satz in indirekter Rede'}
          autoFocus
          rows={3}
          {...NO_AUTOCORRECT}
        />
        {!locked ? <p className="input-hint">{task.eingabehilfe ?? 'Mit oder ohne dass – beides ist richtig. Geprüft werden Verbform, Pronomen und Komma.'}</p> : null}
      </div>
    </div>
  );
}

// ---------- Wort tippen ----------

export function WortExercise({ task, locked, register, onResult }: ExerciseProps & { task: WortTask }) {
  const [value, setValue] = useState('');
  const loesungen = useMemo(() => [task.wort, ...(task.varianten ?? [])], [task]);
  const canSpeak = speechAvailable() && getState().settings.sprachausgabe;
  const spoken = useRef(false);

  useEffect(() => {
    if (canSpeak && !spoken.current) {
      spoken.current = true;
      const t = window.setTimeout(() => speak(task.wort), 250);
      return () => window.clearTimeout(t);
    }
  }, [canSpeak, task.wort]);

  const submit = () => {
    if (locked) return;
    const r = evalTyped(value, loesungen);
    onResult({
      richtig: r.richtig,
      antwort: value.trim(),
      loesung: task.wort,
      hinweise: r.variante ? ['Deine Schreibung ist eine gültige Variante.'] : [],
      detail: typedDetail(r),
    });
  };
  useEffect(() => register(locked ? null : submit));

  return (
    <div>
      <p className="task-instruction">{canSpeak ? 'Hör dir das Wort an und tippe es.' : 'Tippe das gesuchte Wort.'}</p>
      <div className="source-box">
        <div className="eyebrow">Umschreibung</div>
        {typo(task.umschreibung)}
      </div>
      <div className="answer-area">
        <div className="row">
          <input
            className="input read"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
              if (e.key === '.' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                speak(task.wort);
              }
            }}
            readOnly={locked}
            aria-label="Gesuchtes Wort"
            autoFocus
            {...NO_AUTOCORRECT}
          />
          {canSpeak ? (
            <button className="btn icon" onClick={() => speak(task.wort)} aria-label="Wort anhören" title="Anhören (Strg + .)">
              <Icon name="speaker" />
            </button>
          ) : null}
        </div>
        {!canSpeak ? <p className="input-hint">Die Sprachausgabe ist ausgeschaltet oder nicht verfügbar; die Umschreibung genügt.</p> : null}
      </div>
    </div>
  );
}
