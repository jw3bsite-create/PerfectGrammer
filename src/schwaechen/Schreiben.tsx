// Übungsform „Selbst schreiben“: einen eigenen Satz nach Vorgabe bilden; Prüfmuster bewerten ihn.

import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { FbBlock, NO_AUTOCORRECT, type ExerciseResult } from '../exercises/common';
import { typo } from '../lib/normalize';
import { pruefeSchreiben } from './pruefen';
import type { SchreibenTask } from './typen';

export function SchreibenExercise({
  task,
  locked,
  register,
  onResult,
}: {
  task: SchreibenTask;
  locked: boolean;
  register: (fn: (() => void) | null) => void;
  onResult: (r: ExerciseResult) => void;
}) {
  const [value, setValue] = useState('');
  const submit = () => {
    if (locked || !value.trim()) return;
    const r = pruefeSchreiben(value, task.pruefungen);
    onResult({
      richtig: r.richtig,
      antwort: value.trim(),
      loesung: task.beispiel,
      uebersteuerbar: !r.richtig,
      detail: (
        <>
          <FbBlock label="Geprüft">
            <ul className="result-list">
              {r.teile.map((t) => (
                <li key={t.label} className={t.ok ? 'ok' : 'bad'}>
                  <Icon name={t.ok ? 'checkCircle' : 'crossCircle'} />
                  <div>
                    {t.label}
                    <span className="sr-only">{t.ok ? ': erfüllt' : ': nicht erfüllt'}</span>
                  </div>
                </li>
              ))}
            </ul>
          </FbBlock>
          <FbBlock label="Ein möglicher Satz">
            <span className="fb-solution">{typo(task.beispiel)}</span>
          </FbBlock>
        </>
      ),
    });
  };
  useEffect(() => register(locked ? null : submit));
  return (
    <div>
      <p className="task-instruction">Selbst schreiben: Tippe einen ganzen Satz nach dieser Vorgabe.</p>
      <div className="source-box">{typo(task.aufgabe)}</div>
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
          aria-label="Dein Satz"
          placeholder="Dein Satz"
          autoFocus
          rows={3}
          {...NO_AUTOCORRECT}
        />
        {!locked ? <p className="input-hint">Ein Satz mit Großbuchstabe am Anfang und Punkt am Ende genügt.</p> : null}
      </div>
    </div>
  );
}
