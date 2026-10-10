import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { evalTextwiedergabe, pruefTeile } from '../lib/evaluate';
import { typo } from '../lib/normalize';
import type { TextwiedergabeTask } from '../lib/types';
import { FbBlock, NO_AUTOCORRECT, type ExerciseProps } from './common';
import { fehlertyp } from '../lib/fehlertypen';

function sentenceCount(s: string): number {
  return (s.match(/[.!?](\s|$)/g) ?? []).length;
}

export function TextwiedergabeExercise({ task, guided, locked, register, onResult }: ExerciseProps & { task: TextwiedergabeTask }) {
  const [value, setValue] = useState('');

  const submit = () => {
    if (locked || !value.trim()) return;
    const ev = evalTextwiedergabe(value, task.pruefungen, sentenceCount(task.vorlage));
    const ok = ev.checks.filter((c) => c.ok).length;
    const teile = pruefTeile(ev);
    const wrong = ev.checks.filter((c) => !c.ok);
    onResult({
      richtig: ev.richtig,
      teilweise: !ev.richtig && ok > 0,
      antwort: value.trim(),
      loesung: task.muster,
      teile,
      uebersteuerbar: !ev.richtig,
      hinweise: ev.hinweise,
      begruendung: `${ok} von ${ev.checks.length} Prüfstellen richtig. ${task.begruendung}`,
      eintraege: wrong.map((c) => ({
        original: value.trim(),
        korrektur: task.muster,
        fehlertyp: c.fehlertyp,
        begruendung: `${c.label}${c.detail ? `: ${c.detail}` : ''}`,
      })),
      detail: (
        <>
          <FbBlock label="Verbform für Verbform">
            <ul className="result-list">
              {ev.checks.map((c, i) => (
                <li key={i} className={c.ok ? 'ok' : 'bad'}>
                  <Icon name={c.ok ? 'checkCircle' : 'crossCircle'} />
                  <div>
                    <span className="read">{c.label}</span>
                    {c.detail ? <div className="small muted">{c.detail}</div> : null}
                    {!c.ok ? <div className="small muted">{fehlertyp(c.fehlertyp)?.label}</div> : null}
                  </div>
                </li>
              ))}
            </ul>
          </FbBlock>
          <FbBlock label="Musterlösung">
            <p className="fb-solution">{typo(task.muster)}</p>
          </FbBlock>
        </>
      ),
    });
  };
  useEffect(() => register(locked ? null : submit));

  return (
    <div>
      <p className="task-instruction">Gib den Absatz in indirekter Rede wieder. Wechsle die Redeeinleitungen und bleib im Präsens.</p>
      {guided && !locked ? (
        <div className="guide">
          <Icon name="info" />
          <span>Geh Verbform für Verbform vor: Konjunktiv I; gleicht er dem Indikativ, Konjunktiv II; gleicht dieser dem Präteritum, würde mit Infinitiv. Pronomen und Zeitangaben verschieben.</span>
        </div>
      ) : null}
      <div className="source-box">
        <div className="eyebrow">{task.quelle}</div>
        {typo(task.vorlage)}
      </div>
      <div className="answer-area">
        <textarea
          className="textarea read long"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          readOnly={locked}
          aria-label="Wiedergabe in indirekter Rede"
          placeholder="Die Autorin betont, …"
          autoFocus
          {...NO_AUTOCORRECT}
        />
        {!locked ? <p className="input-hint">Enter prüft. Geprüft wird jede Verbform, dazu Pronomen und das Präsens der Redeeinleitungen.</p> : null}
      </div>
    </div>
  );
}
