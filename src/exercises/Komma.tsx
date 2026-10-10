import { Fragment, useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { evalKomma, evalVerben, type KommaEval, type VerbEval } from '../lib/evaluate';
import { kommaSentence, kommaSolution, parseKomma } from '../lib/markup';
import { typo } from '../lib/normalize';
import type { KommaTask } from '../lib/types';
import { FbBlock, KommaSolution, useKeys, type ExerciseProps } from './common';
import { numberWord } from '../components/ui';

type Stage = 'verben' | 'verbenGeprueft' | 'kommas';

const GAP_LABEL: Record<string, string> = {
  richtig: 'Komma richtig',
  fehlt: 'Komma fehlt',
  ueberfluessig: 'Komma überflüssig',
  frei: 'Komma freigestellt',
  leer: 'kein Komma',
};

export function KommaExercise({ task, guided, locked, register, onResult }: ExerciseProps & { task: KommaTask }) {
  const p = useMemo(() => parseKomma(task.text), [task.text]);
  const isProbe = task.typ === 'probe';
  const [stage, setStage] = useState<Stage>(isProbe ? 'verben' : 'kommas');
  const [marked, setMarked] = useState<boolean[]>(() => p.tokens.map(() => false));
  const [commas, setCommas] = useState<boolean[]>(() => p.gaps.map(() => false));
  const [cursor, setCursor] = useState(0);
  const [verbEval, setVerbEval] = useState<VerbEval | null>(null);
  const [kommaEval, setKommaEval] = useState<KommaEval | null>(null);

  const verbsText = p.tokens.filter((t) => t.verb).map((t) => t.text.replace(/[.,;:!?„“"()–]/g, ''));

  const checkVerbs = () => {
    const ev = evalVerben(p, marked);
    setVerbEval(ev);
    setStage('verbenGeprueft');
  };

  const checkCommas = () => {
    const ev = evalKomma(p, commas);
    setKommaEval(ev);
    const verbsOk = verbEval ? verbEval.richtig : true;
    const richtig = ev.richtig && verbsOk;
    const antwort = kommaSentence(p.tokens, commas);
    const loesung = kommaSolution(p);
    const freiCount = ev.gaps.filter((g) => g.status === 'frei').length;
    const hinweise: string[] = [];
    if (freiCount) hinweise.push(freiCount === 1 ? 'Ein Komma ist freigestellt; es zählt in keiner Richtung als Fehler.' : `${freiCount} Kommas sind freigestellt; sie zählen in keiner Richtung als Fehler.`);
    if (verbEval && !verbEval.richtig) hinweise.push('Die gebeugten Verben waren nicht vollständig richtig markiert.');
    onResult({
      richtig,
      antwort: verbEval && !verbEval.richtig ? `${antwort} (markiert: ${p.tokens.filter((_, i) => marked[i]).map((t) => t.text).join(', ') || 'kein Verb'})` : antwort,
      loesung,
      hinweise,
      detail: (
        <FbBlock label="Lösung">
          <KommaSolution p={p} verbs={verbsText.length > 0 && (isProbe || task.kurs === 1)} />
        </FbBlock>
      ),
    });
  };

  const primary = () => {
    if (locked) return;
    if (stage === 'verben') checkVerbs();
    else if (stage === 'verbenGeprueft') {
      setStage('kommas');
      setCursor(0);
    } else checkCommas();
  };

  useEffect(() => {
    register(locked ? null : primary);
  });

  const n = stage === 'kommas' ? p.gaps.length : p.tokens.length;
  useKeys(!locked && stage !== 'verbenGeprueft', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setCursor((c) => Math.min(n - 1, c + 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === ' ' || e.key === ',' || e.key === 'k') {
      if ((e.target as HTMLElement)?.tagName === 'BUTTON' && e.key === ' ' && (e.target as HTMLElement).dataset.idx !== undefined) return;
      e.preventDefault();
      if (stage === 'kommas') toggleComma(cursor);
      else toggleVerb(cursor);
    }
  });

  const toggleVerb = (i: number) => {
    if (locked || stage !== 'verben') return;
    setCursor(i);
    setMarked((m) => m.map((v, k) => (k === i ? !v : v)));
  };
  const toggleComma = (i: number) => {
    if (locked || stage !== 'kommas' || kommaEval) return;
    setCursor(i);
    setCommas((c) => c.map((v, k) => (k === i ? !v : v)));
  };

  const verbCount = verbsText.length;

  return (
    <div>
      {stage === 'verben' || stage === 'verbenGeprueft' ? (
        <p className="task-instruction">
          {isProbe ? 'Schritt 1 von 2: ' : ''}Tippe alle gebeugten Verben an.
        </p>
      ) : (
        <p className="task-instruction">
          {isProbe ? 'Schritt 2 von 2: ' : ''}Tippe auf die Lücken, an denen ein Komma stehen muss.
        </p>
      )}

      {guided && stage === 'verben' ? (
        <div className="guide">
          <Icon name="info" />
          <span>Gebeugt ist das Verb, das sich mit der Person ändert: er sagt, wir sagen. Mehrteilige Prädikate zählen einmal.</span>
        </div>
      ) : null}
      <div className="sentence" aria-live="off">
        {p.tokens.map((t, i) => {
          if (stage === 'verben' || stage === 'verbenGeprueft') {
            const st = verbEval?.marks[i];
            const cls = ['word'];
            if (stage === 'verbenGeprueft' && st) cls.push(`res-${st}`);
            else if (marked[i]) cls.push('marked');
            if (!locked && stage === 'verben' && cursor === i) cls.push('cursor');
            return (
              <Fragment key={i}>
                <button
                  type="button"
                  className={cls.join(' ')}
                  data-idx={i}
                  aria-pressed={marked[i]}
                  aria-label={`${t.text}${marked[i] ? ', als gebeugtes Verb markiert' : ''}${st === 'fehlt' ? ', gebeugtes Verb übersehen' : st === 'zuviel' ? ', kein gebeugtes Verb' : ''}`}
                  onClick={() => toggleVerb(i)}
                  disabled={stage !== 'verben'}
                  tabIndex={stage === 'verben' ? 0 : -1}
                >
                  {typo(t.text)}
                </button>
                {i < p.tokens.length - 1 ? ' ' : ''}
              </Fragment>
            );
          }
          const showVerb = isProbe && t.verb;
          const g = kommaEval?.gaps[i];
          return (
            <Fragment key={i}>
              <span className={showVerb ? 'word verb-hint' : undefined}>{typo(t.text)}</span>
              {i < p.gaps.length ? (
                <>
                  <button
                    type="button"
                    data-idx={i}
                    className={['gap', commas[i] ? 'set' : '', g ? `locked st-${g.status}` : '', !locked && !g && cursor === i ? 'cursor' : ''].join(' ')}
                    onClick={() => toggleComma(i)}
                    aria-pressed={commas[i]}
                    aria-label={g ? GAP_LABEL[g.status] : `Lücke nach „${t.text}“${commas[i] ? ': Komma gesetzt' : ''}`}
                    disabled={!!g}
                  >
                    {g ? (
                      g.status === 'leer' ? null : (
                        <>
                          <span className="comma">{g.status === 'frei' ? '(,)' : ','}</span>
                          <span className="gap-mark" aria-hidden="true">
                            {g.status === 'fehlt' ? 'fehlt' : g.status === 'ueberfluessig' ? 'zu viel' : g.status === 'frei' ? 'frei' : '✓'}
                          </span>
                        </>
                      )
                    ) : commas[i] ? (
                      <span className="comma">,</span>
                    ) : null}
                  </button>
                  {'​'}
                </>
              ) : null}
            </Fragment>
          );
        })}
      </div>

      {stage === 'verbenGeprueft' && verbEval ? (
        <div className={`feedback ${verbEval.richtig ? 'ok' : 'bad'}`}>
          <div className="feedback-head">
            <Icon name={verbEval.richtig ? 'checkCircle' : 'crossCircle'} />
            {verbEval.richtig ? 'Verben richtig' : 'Verben nicht richtig'}
          </div>
          <div className="feedback-body">
            <p className="fb-reason">
              {verbCount === 0
                ? 'Der Satz hat kein gebeugtes Verb.'
                : verbCount === 1
                  ? `Ein gebeugtes Verb: ${verbsText[0]}.`
                  : `${capitalize(numberWord(verbCount))} gebeugte Verben: ${verbsText.join(', ')}.`}
            </p>
            <div className="row">
              <button className="btn primary" onClick={() => setStage('kommas')} autoFocus>
                Weiter: Kommas setzen <span className="kbd">↵</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!locked && stage !== 'verbenGeprueft' ? (
        <div className="actions">
          <button className="btn primary" onClick={primary}>
            {stage === 'verben' ? 'Verben prüfen' : 'Prüfen'} <span className="kbd">↵</span>
          </button>
        </div>
      ) : null}

      {!locked && stage === 'kommas' ? (
        <p className="input-hint">Tastatur: ← → wählt die Lücke, Leertaste setzt oder löscht das Komma.</p>
      ) : null}
      {!locked && stage === 'verben' ? <p className="input-hint">Tastatur: ← → wählt das Wort, Leertaste markiert.</p> : null}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
