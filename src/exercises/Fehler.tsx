import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { evalTask, prepareTask, stellenTeile, type StellenEval } from '../lib/evaluate';
import { DURCHGAENGE, fehlertyp, fehlertypLabel } from '../lib/fehlertypen';
import { normalizeSpaces, typo } from '../lib/normalize';
import { fehlertypOptionen, singleErrorType } from '../lib/sessions';
import { suggestType } from '../lib/errorbook';
import type { FehlerTask, KorrekturTask } from '../lib/types';
import type { EntryDraft } from '../lib/store';
import { FbBlock, NO_AUTOCORRECT, typingTarget, useKeys, type ExerciseProps } from './common';
import { numberWord } from '../components/ui';

// ---------- Bearbeitbarer Text ----------

interface Chunk {
  parts: string[];
  text: string;
}

function initChunks(original: string): Chunk[] {
  return normalizeSpaces(original)
    .split(' ')
    .filter(Boolean)
    .map((w) => ({ parts: [w], text: w }));
}

function finalText(chunks: Chunk[]): string {
  return chunks
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join(' ');
}

function isChanged(c: Chunk) {
  return normalizeSpaces(c.text) !== c.parts.join(' ');
}

interface EditorState {
  start: number;
  end: number;
  value: string;
}

function useChunkEditor(original: string, active: boolean) {
  const [chunks, setChunks] = useState<Chunk[]>(() => initChunks(original));
  const [cursor, setCursor] = useState(0);
  const [edit, setEdit] = useState<EditorState | null>(null);

  const open = (i: number) => {
    if (!active) return;
    setCursor(i);
    setEdit({ start: i, end: i, value: chunks[i].text });
  };
  const extend = () => {
    if (!edit || edit.end >= chunks.length - 1) return;
    const end = edit.end + 1;
    setEdit({ ...edit, end, value: `${edit.value} ${chunks[end].text}`.trim() });
  };
  const apply = () => {
    if (!edit) return;
    const parts = chunks.slice(edit.start, edit.end + 1).flatMap((c) => c.parts);
    const value = normalizeSpaces(edit.value);
    let replacement: Chunk[];
    if (value === parts.join(' ')) replacement = parts.map((p) => ({ parts: [p], text: p }));
    else replacement = [{ parts, text: value }];
    setChunks([...chunks.slice(0, edit.start), ...replacement, ...chunks.slice(edit.end + 1)]);
    setCursor(edit.start);
    setEdit(null);
  };
  const reset = () => {
    if (!edit) return;
    const parts = chunks.slice(edit.start, edit.end + 1).flatMap((c) => c.parts);
    setChunks([...chunks.slice(0, edit.start), ...parts.map((p) => ({ parts: [p], text: p })), ...chunks.slice(edit.end + 1)]);
    setEdit(null);
  };
  const cancel = () => setEdit(null);
  return { chunks, cursor, setCursor, edit, setEdit, open, extend, apply, reset, cancel, changedCount: chunks.filter(isChanged).length };
}

type Editor = ReturnType<typeof useChunkEditor>;

function ChunkText({ ed, active, paragraph }: { ed: Editor; active: boolean; paragraph?: boolean }) {
  return (
    <div className={`sentence${paragraph ? ' paragraph' : ''}`}>
      {ed.chunks.map((c, i) => {
        const inSel = ed.edit && i >= ed.edit.start && i <= ed.edit.end;
        const cls = ['chunk'];
        if (inSel) cls.push('sel');
        else if (isChanged(c)) cls.push(c.text.trim() ? 'changed' : 'changed empty');
        if (active && !ed.edit && ed.cursor === i) cls.push('cursor');
        const shown = c.text.trim() ? c.text : c.parts.join(' ');
        return (
          <Fragment key={i}>
            <button
              type="button"
              className={cls.join(' ')}
              onClick={() => ed.open(i)}
              disabled={!active}
              tabIndex={active ? 0 : -1}
              aria-label={`${shown}${isChanged(c) ? `, geändert (vorher: ${c.parts.join(' ')})` : ''}`}
            >
              {typo(shown)}
            </button>
            {i < ed.chunks.length - 1 ? ' ' : ''}
          </Fragment>
        );
      })}
    </div>
  );
}

function EditBar({ ed }: { ed: Editor }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [ed.edit?.start, ed.edit?.end]);
  if (!ed.edit) return null;
  const e = ed.edit;
  const orig = ed.chunks
    .slice(e.start, e.end + 1)
    .flatMap((c) => c.parts)
    .join(' ');
  return (
    <div className="editbar" role="group" aria-label="Stelle korrigieren">
      <div className="label">
        Stelle korrigieren · ursprünglich: <span style={{ fontFamily: 'var(--font-read)' }}>{typo(orig)}</span>
      </div>
      <input
        ref={inputRef}
        className="input"
        value={e.value}
        onChange={(ev) => ed.setEdit({ ...e, value: ev.target.value })}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            ed.apply();
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopPropagation();
            ed.cancel();
          } else if (ev.key === 'ArrowRight' && ev.altKey) {
            ev.preventDefault();
            ed.extend();
          }
        }}
        aria-label="Korrigierte Fassung"
        {...NO_AUTOCORRECT}
      />
      <div className="row">
        <button className="btn primary small" onClick={ed.apply}>
          Übernehmen <span className="kbd">↵</span>
        </button>
        <button className="btn small" onClick={ed.extend} disabled={e.end >= ed.chunks.length - 1} title="Alt + →">
          <Icon name="plus" /> nächstes Wort
        </button>
        <button className="btn small ghost" onClick={ed.reset}>
          Zurücksetzen
        </button>
        <button className="btn small ghost" onClick={ed.cancel}>
          Abbrechen <span className="kbd">Esc</span>
        </button>
      </div>
      <p className="input-hint">Ein Komma gehört direkt ans Wort davor. Zum Zusammenschreiben das nächste Wort dazunehmen.</p>
    </div>
  );
}

function useChunkKeys(ed: Editor, active: boolean) {
  useKeys(active && !ed.edit, (e) => {
    if (typingTarget(e)) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      ed.setCursor((c) => Math.min(ed.chunks.length - 1, c + 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      ed.setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === ' ' || e.key === 'e') {
      if ((e.target as HTMLElement)?.tagName === 'BUTTON' && e.key === ' ') return;
      e.preventDefault();
      ed.open(ed.cursor);
    }
  });
}

// ---------- Auswertung anzeigen ----------

function StellenList({ ev, defaultTyp, showTypes }: { ev: StellenEval; defaultTyp: string; showTypes?: boolean }) {
  return (
    <ul className="result-list">
      {ev.stellen.map((s, i) => {
        const ok = s.ergebnis === 'gefunden';
        const typ = s.fehler.fehlertyp ?? defaultTyp;
        return (
          <li key={i} className={ok ? 'ok' : 'bad'}>
            <Icon name={ok ? 'checkCircle' : 'crossCircle'} />
            <div>
              <div>
                <span className="read">
                  <span className={ok ? 'mark-ok' : 'mark-bad'}>{typo(s.fehler.falsch.trim() || '∅')}</span> → <strong>{typo(s.fehler.richtig.trim() || 'streichen')}</strong>
                </span>
                {' · '}
                <span className="muted small">{ok ? 'gefunden' : s.ergebnis === 'falsch' ? `angetippt, aber falsch korrigiert (${s.nutzer || 'gelöscht'})` : 'übersehen'}</span>
              </div>
              {showTypes ? <div className="small muted">{fehlertypLabel(typ)}{s.fehler.begruendung ? ` – ${s.fehler.begruendung}` : ''}</div> : null}
            </div>
          </li>
        );
      })}
      {ev.falschGeaendert.map((f, i) => (
        <li key={`f${i}`} className="bad">
          <Icon name="minusCircle" />
          <div>
            <span className="read">
              {typo(f.vorher || '∅')} → <span className="mark-bad">{typo(f.nachher || 'gelöscht')}</span>
            </span>
            {' · '}
            <span className="muted small">fälschlich geändert; hier war alles richtig</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function fehlerDrafts(ev: StellenEval, task: FehlerTask | KorrekturTask): EntryDraft[] {
  const drafts: EntryDraft[] = [];
  for (const s of ev.stellen) {
    if (s.ergebnis === 'gefunden') continue;
    drafts.push({
      original: s.ergebnis === 'falsch' ? s.nutzer : s.fehler.falsch.trim(),
      korrektur: s.fehler.richtig.trim() || '(streichen)',
      fehlertyp: s.fehler.fehlertyp ?? task.fehlertyp,
      begruendung: s.fehler.begruendung ?? fehlertyp(s.fehler.fehlertyp ?? task.fehlertyp)?.hinweis,
    });
  }
  for (const f of ev.falschGeaendert) {
    drafts.push({
      original: f.nachher || '(gelöscht)',
      korrektur: f.vorher || '(nichts einfügen)',
      fehlertyp: suggestType(f.nachher, f.vorher) ?? task.fehlertyp,
      begruendung: 'Fälschlich geändert: An dieser Stelle war der Text richtig.',
    });
  }
  return drafts;
}

// ---------- Fehler finden (und Fehlertyp bestimmen) ----------

export function FehlerExercise({ task, modus, guided, locked, register, onResult }: ExerciseProps & { task: FehlerTask }) {
  const prep = useMemo(() => prepareTask(task.text), [task.text]);
  const typMode = modus === 'fehlertyp' || task.typ === 'fehlertyp';
  const [stage, setStage] = useState<'typ' | 'typGeprueft' | 'korrektur'>(typMode ? 'typ' : 'korrektur');
  const [typWahl, setTypWahl] = useState<string | null>(null);
  const optionen = useMemo(() => (typMode ? fehlertypOptionen(task) : []), [task, typMode]);
  const richtigerTyp = typMode ? singleErrorType(task) : task.fehlertyp;
  const ed = useChunkEditor(prep.base.original, !locked && stage === 'korrektur');
  useChunkKeys(ed, !locked && stage === 'korrektur');

  const chooseType = (t: string) => {
    if (stage !== 'typ') return;
    setTypWahl(t);
    setStage('typGeprueft');
  };

  useKeys(!locked && stage === 'typ', (e) => {
    if (typingTarget(e)) return;
    const n = Number(e.key);
    if (n >= 1 && n <= optionen.length) {
      e.preventDefault();
      chooseType(optionen[n - 1]);
    }
  });

  const submit = () => {
    if (locked) return;
    if (stage === 'typ') return;
    if (stage === 'typGeprueft') {
      setStage('korrektur');
      return;
    }
    if (ed.edit) {
      ed.apply();
      return;
    }
    const final = finalText(ed.chunks);
    const r = evalTask(prep, final);
    const typOk = typMode ? typWahl === richtigerTyp : true;
    const richtig = r.richtig && typOk;
    const hinweise: string[] = [];
    if (typMode && !typOk) hinweise.push(`Fehlertyp: richtig wäre „${fehlertypLabel(richtigerTyp)}“, nicht „${fehlertypLabel(typWahl ?? '')}“.`);
    for (const fr of prep.frei) hinweise.push(`Freigestellt: „${fr.falsch.trim()}“ oder „${fr.richtig.trim()}“ – beide Fassungen sind richtig.`);
    if (prep.fehler.length === 0) hinweise.push(r.richtig ? 'Der Satz war fehlerfrei. Gut, dass du nichts geändert hast.' : 'Der Satz war fehlerfrei.');
    onResult({
      richtig,
      antwort: typMode && !typOk ? `${final} (Fehlertyp: ${fehlertypLabel(typWahl ?? '')})` : final,
      loesung: prep.base.loesung,
      hinweise,
      fehlertypOverride: typMode ? richtigerTyp : undefined,
      detail: (
        <>
          {!r.richtig || prep.fehler.length > 0 ? (
            <FbBlock label="Richtig">
              <span className="fb-solution">{typo(prep.base.loesung)}</span>
            </FbBlock>
          ) : null}
          {prep.fehler.length || r.falschGeaendert.length ? (
            <FbBlock label="Stellen">
              <StellenList ev={r} defaultTyp={task.fehlertyp} showTypes={typMode} />
            </FbBlock>
          ) : null}
        </>
      ),
    });
  };
  useEffect(() => register(locked ? null : submit));

  if (stage === 'typ' || stage === 'typGeprueft') {
    return (
      <div>
        <p className="task-instruction">Schritt 1 von 2: Welcher Fehlertyp steckt in diesem Satz?</p>
        <p className="sentence">{typo(prep.base.original)}</p>
        <div className="options" role="group" aria-label="Fehlertypen">
          {optionen.map((o, i) => {
            let cls = 'option ui';
            let status: string | null = null;
            if (stage === 'typGeprueft') {
              if (o === richtigerTyp) {
                cls += ' st-ok';
                status = 'richtig';
              } else if (o === typWahl) {
                cls += ' st-bad';
                status = 'falsch';
              }
            }
            const ft = fehlertyp(o);
            return (
              <button key={o} className={cls} onClick={() => chooseType(o)} disabled={stage !== 'typ'} autoFocus={i === 0}>
                <span className="kbd">{i + 1}</span>
                <span>
                  {ft?.label}
                  <span className="muted small"> · {ft ? bereichName(ft.bereich) : ''}</span>
                </span>
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
        {stage === 'typGeprueft' ? (
          <div className="actions">
            <button className="btn primary" onClick={() => setStage('korrektur')} autoFocus>
              Weiter: Satz korrigieren <span className="kbd">↵</span>
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <p className="task-instruction">
        {typMode ? 'Schritt 2 von 2: ' : ''}Tippe die fehlerhafte Stelle an und korrigiere sie. Der Satz kann auch fehlerfrei sein.
      </p>
      {guided && !locked ? (
        <div className="guide">
          <Icon name="info" />
          <span>
            {prep.fehler.length === 0
              ? 'Prüfe jede Stelle mit der Probe. Nicht jeder Satz enthält einen Fehler.'
              : `In diesem Satz ${prep.fehler.length === 1 ? 'steckt ein Fehler' : `stecken ${numberWord(prep.fehler.length)} Fehler`}.`}
          </span>
        </div>
      ) : null}
      <ChunkText ed={ed} active={!locked} />
      {!locked ? <EditBar ed={ed} /> : null}
      {!locked && !ed.edit ? (
        <div className="actions">
          <button className="btn primary" onClick={submit}>
            {ed.changedCount === 0 ? 'Satz ist fehlerfrei' : 'Prüfen'} <span className="kbd">↵</span>
          </button>
        </div>
      ) : null}
      {!locked && !ed.edit ? <p className="input-hint">Tastatur: ← → wählt das Wort, Leertaste öffnet die Korrektur, Enter prüft.</p> : null}
    </div>
  );
}

function bereichName(b: string): string {
  const map: Record<string, string> = { komma: 'Komma', fall: 'Fall', konjunktiv: 'Konjunktiv', rechtschreibung: 'Rechtschreibung', zeichen: 'Zeichen', wortsatz: 'Wort und Satz' };
  return map[b] ?? b;
}

// ---------- Korrekturlesen (Kurs 10) ----------

export function KorrekturExercise({ task, guided, locked, register, onResult }: ExerciseProps & { task: KorrekturTask }) {
  const prep = useMemo(() => prepareTask(task.text), [task.text]);
  const [pass, setPass] = useState(1);
  const ed = useChunkEditor(prep.base.original, !locked);
  useChunkKeys(ed, !locked);

  const perPass = useMemo(() => {
    const c = [0, 0, 0, 0];
    for (const f of prep.fehler) c[fehlertyp(f.fehlertyp ?? '')?.durchgang ?? 3]++;
    return c;
  }, [prep]);

  const evaluate = () => {
    const final = finalText(ed.chunks);
    const r = evalTask(prep, final);
    const teile = stellenTeile(r, task.fehlertyp);
    const found = r.stellen.filter((s) => s.ergebnis === 'gefunden').length;
    const total = r.stellen.length;
    const richtig = r.richtig;
    onResult({
      richtig,
      teilweise: !richtig && found > 0,
      antwort: final,
      loesung: prep.base.loesung,
      teile,
      eintraege: fehlerDrafts(r, task),
      begruendung: `${found} von ${total} Fehlern gefunden, ${r.falschGeaendert.length === 0 ? 'keine Stelle fälschlich geändert' : r.falschGeaendert.length === 1 ? 'eine Stelle fälschlich geändert' : `${r.falschGeaendert.length} Stellen fälschlich geändert`}.`,
      detail: <KorrekturResult ev={r} task={task} />,
    });
  };

  const primary = () => {
    if (locked) return;
    if (ed.edit) {
      ed.apply();
      return;
    }
    if (pass < 3) setPass(pass + 1);
    else evaluate();
  };
  useEffect(() => register(locked ? null : primary));

  const d = DURCHGAENGE[pass - 1];
  return (
    <div>
      <div className="source-box" style={{ marginBottom: 20, fontFamily: 'var(--font-ui)', fontSize: 15 }}>
        <div className="passes" aria-hidden="true">
          {[1, 2, 3].map((p) => (
            <span key={p} className={p < pass ? 'done' : p === pass ? 'now' : ''} />
          ))}
        </div>
        <div className="row between pass-head">
          <strong>
            Durchgang {pass} von 3: {d.titel}
          </strong>
          {guided ? <span className="badge">{perPass[pass] === 1 ? 'ein Fehler' : `${numberWord(perPass[pass])} Fehler`} in diesem Durchgang</span> : null}
        </div>
        <ul className="checklist">
          {d.punkte.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      {task.aufgabe ? <p className="task-meta">{task.aufgabe}</p> : null}
      <h3 style={{ fontFamily: 'var(--font-read)', fontWeight: 600, marginBottom: 10 }}>{typo(task.titel)}</h3>
      <ChunkText ed={ed} active={!locked} paragraph />
      {!locked ? <EditBar ed={ed} /> : null}
      {!locked && !ed.edit ? (
        <div className="actions">
          {pass > 1 ? (
            <button className="btn ghost" onClick={() => setPass(pass - 1)}>
              <Icon name="chevronLeft" /> Durchgang {pass - 1}
            </button>
          ) : null}
          <span className="spacer" />
          <span className="muted small">{ed.changedCount === 1 ? 'eine Änderung' : `${ed.changedCount} Änderungen`}</span>
          <button className="btn primary" onClick={primary}>
            {pass < 3 ? `Weiter zu Durchgang ${pass + 1}` : 'Auswerten'} <span className="kbd">↵</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function KorrekturResult({ ev, task }: { ev: StellenEval; task: KorrekturTask }) {
  const gefunden = ev.stellen.filter((s) => s.ergebnis === 'gefunden');
  const uebersehen = ev.stellen.filter((s) => s.ergebnis !== 'gefunden');
  const group = (title: string, cls: string, icon: string, children: ReactNode, n: number) => (
    <div>
      <div className={`group-title ${cls}`}>
        <Icon name={icon} />
        {title} ({n})
      </div>
      {children}
    </div>
  );
  const line = (s: (typeof ev.stellen)[number], i: number) => {
    const typ = s.fehler.fehlertyp ?? task.fehlertyp;
    const ft = fehlertyp(typ);
    return (
      <li key={i} className={s.ergebnis === 'gefunden' ? 'ok' : 'bad'}>
        <Icon name={s.ergebnis === 'gefunden' ? 'check' : 'cross'} />
        <div>
          <span className="read">
            {typo(s.fehler.falsch.trim() || '∅')} → <strong>{typo(s.fehler.richtig.trim() || 'streichen')}</strong>
          </span>
          <div className="small muted">
            {ft ? `${ft.label} · Durchgang ${ft.durchgang}` : ''}
            {s.ergebnis === 'falsch' ? ` · angetippt, aber falsch korrigiert (${s.nutzer || 'gelöscht'})` : ''}
            {s.fehler.begruendung ? ` – ${s.fehler.begruendung}` : ''}
          </div>
        </div>
      </li>
    );
  };
  return (
    <div className="stack">
      {group('Gefunden', 'ok', 'checkCircle', <ul className="result-list">{gefunden.map(line)}</ul>, gefunden.length)}
      {group('Übersehen', 'bad', 'crossCircle', uebersehen.length ? <ul className="result-list">{uebersehen.map(line)}</ul> : <p className="small muted">Keine.</p>, uebersehen.length)}
      {group(
        'Fälschlich geändert',
        'frei',
        'minusCircle',
        ev.falschGeaendert.length ? (
          <ul className="result-list">
            {ev.falschGeaendert.map((f, i) => (
              <li key={i} className="frei">
                <Icon name="minusCircle" />
                <span className="read">
                  {typo(f.vorher || '∅')} → <span className="mark-bad">{typo(f.nachher || 'gelöscht')}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Keine.</p>
        ),
        ev.falschGeaendert.length,
      )}
      <FbBlock label="Berichtigter Text">
        <p className="fb-solution">{typo(ev.loesung)}</p>
      </FbBlock>
    </div>
  );
}
