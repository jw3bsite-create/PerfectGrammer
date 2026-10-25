// Trainingssitzung des Moduls „Meine Schwächen“: Aufgabe lösen, Regel wählen, Rückmeldung mit der Methode der Kategorie.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Confirm, Empty, Progress, RuleCard, Sheet } from '../components/ui';
import type { ExerciseResult } from '../exercises/common';
import { TaskView } from '../exercises/TaskView';
import { dayKey } from '../lib/dates';
import { getLesson } from '../lib/content';
import { evalTask, prepareTask } from '../lib/evaluate';
import { typo } from '../lib/normalize';
import { navigate } from '../lib/router';
import { useApp } from '../lib/store';
import type { Task } from '../lib/types';
import { antwortSpeichern, letzteAlsRichtig, sitzungAbbrechen, sitzungBeenden, starteKategorie, starteMisch, starteTransfer } from './aktionen';
import { aufgabe, istMythos, KATEGORIEN, kategorie, regel, regelOptionen, transferKats } from './daten';
import { katStand, pruefungFaellig, STUFE_TEXT } from './logik';
import { SchreibenExercise as Schreiben } from './Schreiben';
import type { SAufgabe, SItem, SRegel } from './typen';
import { AmpelBadge, KursLinks } from './Teile';

/** Bezeichnungen der Übungsformen im Modul. */
export const FORM_LABEL: Record<string, string> = {
  entscheiden: 'Entscheiden',
  eintippen: 'Lückentext',
  umformen: 'Umformen',
  fehler: 'Fehlerjagd',
  komma: 'Komma setzen',
  schreiben: 'Selbst schreiben',
  transfer: 'Transfer',
};

export function formLabel(a: SAufgabe): string {
  return a.kat === 'T' ? FORM_LABEL.transfer : (FORM_LABEL[a.typ] ?? a.typ);
}

interface Offen {
  index: number;
  item: SItem;
  aufgabe: SAufgabe;
  result: ExerciseResult;
}

interface Stelle {
  kat: string;
  regel: string;
  falsch: string;
  richtig: string;
  ok: boolean;
}

interface Beantwortet extends Offen {
  antwortOk: boolean;
  regelOk: boolean;
  gewaehlt?: string;
  gewaehltKats?: string[];
  kontrolle: boolean;
  stellen?: Stelle[];
  overridden?: boolean;
  last: boolean;
}

function transferStellen(a: SAufgabe, antwort: string): Stelle[] {
  if (a.typ !== 'fehler') return [];
  const ev = evalTask(prepareTask(a.text), antwort);
  return ev.stellen.map((s) => {
    const r = s.fehler.fehlertyp ?? '';
    return { kat: r.split('.')[0], regel: r, falsch: s.fehler.falsch.trim(), richtig: s.fehler.richtig.trim(), ok: s.ergebnis === 'gefunden' };
  });
}

function anweisung(a: SAufgabe): string | undefined {
  if (a.typ !== 'fehler') return undefined;
  return a.kat === 'T'
    ? 'In diesem Absatz stecken mehrere Fehler aus verschiedenen Kategorien. Tippe jede fehlerhafte Stelle an und korrigiere sie.'
    : 'In diesem Satz steckt genau ein Fehler. Tippe die Stelle an und korrigiere sie.';
}

export function Training() {
  const data = useApp();
  const s = data.schwaechen;
  const sitz = s.sitzung;
  const [offen, setOffen] = useState<Offen | null>(null);
  const [fertig, setFertig] = useState<Beantwortet | null>(null);
  const [kats, setKats] = useState<string[]>([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [erklaerung, setErklaerung] = useState(false);
  const submitRef = useRef<(() => void) | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const item = sitz ? sitz.items[sitz.index] : undefined;
  const current = item ? aufgabe(item.taskId, s.eigene) : undefined;

  // Eine neue Sitzung (etwa „Noch einmal“) verwirft den Zwischenstand der alten.
  const sitzId = sitz?.id;
  useEffect(() => {
    setOffen(null);
    setFertig(null);
    setKats([]);
    submitRef.current = null;
  }, [sitzId]);

  const register = useCallback((fn: (() => void) | null) => {
    submitRef.current = fn;
  }, []);

  const onResult = useCallback(
    (r: ExerciseResult) => {
      if (!sitz || !item || !current || offen || fertig) return;
      setOffen({ index: sitz.index, item, aufgabe: current, result: r });
      setKats([]);
    },
    [sitz, item, current, offen, fertig],
  );

  const speichern = useCallback(
    async (wahl: { regel?: string; kats?: string[] }) => {
      if (!offen || !sitz || busy.current) return;
      busy.current = true;
      try {
        const a = offen.aufgabe;
        const antwortOk = offen.result.richtig;
        let regelOk = false;
        let stellen: Stelle[] | undefined;
        let fehlerKats: string[] | undefined;
        let fehlerRegeln: string[] | undefined;
        if (a.kat === 'T') {
          const soll = transferKats(a);
          const ist = [...(wahl.kats ?? [])].sort();
          regelOk = soll.length === ist.length && soll.every((k) => ist.includes(k));
          stellen = transferStellen(a, offen.result.antwort);
          const fk = new Set(stellen.filter((x) => !x.ok).map((x) => x.kat));
          for (const k of soll) if (!ist.includes(k)) fk.add(k);
          fehlerKats = [...fk];
          fehlerRegeln = [...new Set(stellen.filter((x) => !x.ok && x.regel).map((x) => x.regel))];
        } else {
          regelOk = wahl.regel === a.regel;
        }
        const { kontrolle } = await antwortSpeichern(a, {
          antwortOk,
          regelOk,
          antwort: offen.result.antwort,
          gewaehlt: wahl.regel ?? wahl.kats?.join(','),
          fehlerKats,
          fehlerRegeln,
        });
        setFertig({
          ...offen,
          antwortOk,
          regelOk,
          gewaehlt: wahl.regel,
          gewaehltKats: wahl.kats,
          kontrolle,
          stellen,
          last: offen.index + 1 >= sitz.items.length + (kontrolle ? 1 : 0),
        });
        setOffen(null);
      } finally {
        busy.current = false;
      }
    },
    [offen, sitz],
  );

  const weiter = useCallback(async () => {
    if (!fertig || busy.current) return;
    if (fertig.last) {
      busy.current = true;
      try {
        await sitzungBeenden();
      } finally {
        busy.current = false;
      }
    }
    setFertig(null);
    submitRef.current = null;
    window.scrollTo(0, 0);
  }, [fertig]);

  useEffect(() => {
    if (fertig) feedbackRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [fertig]);

  const optionen: SRegel[] = useMemo(() => (offen && offen.aufgabe.kat !== 'T' ? regelOptionen(offen.aufgabe) : []), [offen]);

  // Tastatur: Enter prüft und geht weiter, Ziffern wählen die Regel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || confirmEnd || erklaerung || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (offen && optionen.length) {
        const n = Number(e.key);
        if (n >= 1 && n <= optionen.length) {
          e.preventDefault();
          void speichern({ regel: optionen[n - 1].id });
        }
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.repeat) {
        const isTaskButton = tag === 'BUTTON' && (target.classList.contains('gap') || target.classList.contains('word') || target.classList.contains('chunk'));
        if (tag === 'BUTTON' && !isTaskButton) return;
        e.preventDefault();
        if (fertig) void weiter();
        else if (!offen) submitRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [offen, optionen, fertig, confirmEnd, erklaerung, speichern, weiter]);

  if (!sitz && !fertig) {
    if (s.letzte) return <Ergebnis />;
    return (
      <div className="practice">
        <main className="practice-body">
          <Empty icon="target" title="Kein laufendes Training" action={<a className="btn primary" href="#/schwaechen">Zur Übersicht</a>}>
            Wähle in der Übersicht eine Kategorie oder das gemischte Training.
          </Empty>
        </main>
      </div>
    );
  }

  const shown = fertig ?? offen;
  const a = shown?.aufgabe ?? current;
  const shownItem = shown?.item ?? item;
  const index = shown?.index ?? sitz?.index ?? 0;
  const total = sitz?.items.length ?? index + 1;
  const done = sitz?.ergebnisse.length ?? index + 1;
  const k = a && a.kat !== 'T' ? kategorie(a.kat) : undefined;
  const st = sitz?.kat ? katStand(s, sitz.kat) : undefined;
  const pruefung = !!st && pruefungFaellig(st, dayKey());
  // Im gemischten Training verrät die Kategorie die Lösung; sie erscheint erst nach der Antwort.
  const zeigeKat = !!k && (sitz?.art === 'kategorie' || !!fertig);

  return (
    <div className="practice sw-training">
      <header className="practice-head">
        <div className="practice-head-inner">
          <button className="btn icon small ghost" onClick={() => setConfirmEnd(true)} aria-label="Training beenden" title="Training beenden">
            <Icon name="close" />
          </button>
          <Progress value={total ? done / total : 0} label="Fortschritt" />
          <span className="count">
            {Math.min(done + (fertig ? 0 : 1), total)} / {total}
          </span>
          {a ? (
            <button className="btn small ghost" onClick={() => setErklaerung(true)} title="Erklärung" data-erklaerung>
              <Icon name="card" /> Erklärung
            </button>
          ) : null}
        </div>
      </header>

      <main className="practice-body">
        <div className="sr-only" aria-live="polite">
          {fertig ? (fertig.antwortOk && fertig.regelOk) || fertig.overridden ? 'Richtig' : 'Falsch' : ''}
        </div>
        {a && shownItem ? (
          <>
            <div className="task-meta">
              <span>{[sitz?.titel ?? 'Meine Schwächen', pruefung ? 'Prüfung' : null, zeigeKat && sitz?.art !== 'kategorie' ? k?.titel : null, formLabel(a)].filter(Boolean).join(' · ')}</span>
              {shownItem.kontrolle ? <span className="badge outline">Kontrollaufgabe</span> : null}
              {a.geprueft === false ? <span className="badge outline">aus deinen Fehlern</span> : null}
            </div>
            <div data-task={a.id} data-kat={a.kat}>
              {a.typ === 'schreiben' ? (
                <Schreiben key={`${sitz?.id}-${index}`} task={a} locked={!!shown} register={register} onResult={onResult} />
              ) : (
                <TaskView
                  key={`${sitz?.id}-${index}`}
                  task={a as Task}
                  guided={false}
                  locked={!!shown}
                  anweisung={anweisung(a)}
                  register={register}
                  onResult={onResult}
                />
              )}
            </div>

            {offen && offen.aufgabe.kat !== 'T' ? (
              <section className="card sw-wahl" aria-labelledby="sw-wahl-titel" data-phase="regel">
                <h3 id="sw-wahl-titel">Und warum? Wähle die Regel, die hier entscheidet.</h3>
                <p className="small muted">Richtig ist die Aufgabe erst, wenn Antwort und Begründung stimmen.</p>
                <div className="options" role="group" aria-label="Regeln">
                  {optionen.map((o, i) => (
                    <button key={o.id} className="option ui" data-regel={o.id} onClick={() => void speichern({ regel: o.id })} autoFocus={i === 0}>
                      <span className="kbd">{i + 1}</span>
                      <span>{typo(o.text)}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {offen && offen.aufgabe.kat === 'T' ? (
              <section className="card sw-wahl" aria-labelledby="sw-wahl-titel" data-phase="kategorien">
                <h3 id="sw-wahl-titel">Und warum? Zu welchen Kategorien gehören die Fehler im Absatz?</h3>
                <p className="small muted">Wähle alle Kategorien, in denen ein Fehler steckte. Richtig ist die Aufgabe erst, wenn Korrektur und Kategorien stimmen.</p>
                <div className="chips" role="group" aria-label="Kategorien">
                  {KATEGORIEN.map((kk) => (
                    <button
                      key={kk.id}
                      className="chip"
                      data-kat={kk.id}
                      aria-pressed={kats.includes(kk.id)}
                      onClick={() => setKats((xs) => (xs.includes(kk.id) ? xs.filter((x) => x !== kk.id) : [...xs, kk.id]))}
                    >
                      {kk.titel}
                    </button>
                  ))}
                </div>
                <div className="actions">
                  <button className="btn primary" disabled={!kats.length} onClick={() => void speichern({ kats })}>
                    Prüfen
                  </button>
                </div>
              </section>
            ) : null}

            {fertig ? (
              <div ref={feedbackRef}>
                <Rueckmeldung
                  b={fertig}
                  onNext={() => void weiter()}
                  onOverride={async () => {
                    if (await letzteAlsRichtig()) setFertig({ ...fertig, overridden: true, kontrolle: false, last: fertig.index + 1 >= (sitz?.items.length ?? 0) - (fertig.kontrolle ? 1 : 0) });
                  }}
                />
              </div>
            ) : null}
            {zeigeKat && k && st && sitz?.art === 'kategorie' && !shown ? (
              <p className="small muted" style={{ marginTop: 24 }}>
                <AmpelBadge stand={st} /> {STUFE_TEXT[st.stufe]}
              </p>
            ) : null}
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

      {erklaerung ? (
        <Sheet title={zeigeKat && k ? k.titel : a?.kat === 'T' && fertig ? 'Kategorien in diesem Absatz' : 'Alle Methoden'} eyebrow="Erklärung" onClose={() => setErklaerung(false)}>
          <SwErklaerung kats={zeigeKat && k ? [k.id] : a?.kat === 'T' && fertig ? transferKats(a) : []} regelnZeigen={!offen} />
        </Sheet>
      ) : null}
      {confirmEnd ? (
        <Confirm
          title="Training beenden?"
          text="Beantwortete Aufgaben bleiben gespeichert. Für eine Prüfung zählt nur ein vollständiges Training."
          confirmLabel="Beenden"
          onCancel={() => setConfirmEnd(false)}
          onConfirm={async () => {
            const kat = sitz?.kat;
            setConfirmEnd(false);
            await sitzungAbbrechen();
            navigate(kat ? `/schwaechen/kat/${kat}` : '/schwaechen');
          }}
        />
      ) : null}
    </div>
  );
}

function Rueckmeldung({ b, onNext, onOverride }: { b: Beantwortet; onNext: () => void; onOverride: () => void }) {
  const a = b.aufgabe;
  const r = b.result;
  const antwortOk = b.antwortOk || !!b.overridden;
  const ok = antwortOk && b.regelOk;
  const k = a.kat !== 'T' ? kategorie(a.kat) : undefined;
  const richtigeRegel = regel(a.regel);
  const gewaehlt = b.gewaehlt ? regel(b.gewaehlt) : undefined;
  let head: string;
  if (ok) head = 'Richtig: Antwort und Begründung stimmen';
  else if (antwortOk) head = a.kat === 'T' ? 'Korrektur richtig, Kategorien falsch' : 'Antwort richtig, Begründung falsch';
  else if (b.regelOk) head = a.kat === 'T' ? 'Kategorien richtig, Korrektur falsch' : 'Begründung richtig, Antwort falsch';
  else head = a.kat === 'T' ? 'Korrektur und Kategorien falsch' : 'Antwort und Begründung falsch';

  const transferKatsIst = a.kat === 'T' ? transferKats(a) : [];
  const lessonIds = k ? k.kurse : [...new Set(transferKatsIst.flatMap((x) => kategorie(x)?.kurse ?? []))];

  return (
    <div className={`feedback ${ok ? 'ok' : 'bad'}`} role="region" aria-label="Rückmeldung">
      <div className="feedback-head">
        <Icon name={ok ? 'checkCircle' : 'crossCircle'} />
        {head}
      </div>
      <div className="feedback-body">
        {r.detail}
        {a.kat === 'T' && b.stellen ? (
          <div>
            <div className="fb-label">Fehler und Kategorien</div>
            <ul className="result-list">
              {b.stellen.map((x, i) => {
                const kk = kategorie(x.kat);
                return (
                  <li key={i} className={x.ok ? 'ok' : 'bad'}>
                    <Icon name={x.ok ? 'checkCircle' : 'crossCircle'} />
                    <div>
                      <div>
                        <span className="read">
                          {typo(x.falsch || '∅')} → <strong>{typo(x.richtig || 'streichen')}</strong>
                        </span>{' '}
                        <span className="muted small">· {kk?.titel}</span>
                      </div>
                      <div className="small muted">
                        {kk?.methode.split(':')[0]}: {typo(regel(x.regel)?.text ?? '')}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="small" style={{ marginTop: 10 }}>
              Deine Wahl: {(b.gewaehltKats ?? []).map((x) => kategorie(x)?.titel).join(', ') || '–'}. Fehler steckten in: {transferKatsIst.map((x) => kategorie(x)?.titel).join(', ')}.
            </p>
          </div>
        ) : null}
        {k ? (
          <div>
            <div className="fb-label">Die Methode: {k.titel}</div>
            <p className="fb-reason">{typo(k.methode)}</p>
          </div>
        ) : null}
        <div>
          <div className="fb-label">Begründung</div>
          <p className="fb-reason">{typo(a.begruendung)}</p>
        </div>
        {richtigeRegel ? (
          <div>
            <div className="fb-label">Die Regel</div>
            <p className="sw-regel ok">
              <Icon name="check" /> {typo(richtigeRegel.text)}
            </p>
            {!b.regelOk && gewaehlt ? (
              <p className="sw-regel bad">
                <Icon name="cross" /> Deine Wahl: {typo(gewaehlt.text)}
                {istMythos(gewaehlt.id) ? <span className="muted"> Das ist ein verbreiteter Irrtum.</span> : null}
              </p>
            ) : null}
          </div>
        ) : null}
        {(r.hinweise ?? []).map((h, i) => (
          <p key={i} className="fb-note">
            <Icon name="info" />
            {h}
          </p>
        ))}
        {b.kontrolle && !b.overridden ? (
          <div className="notice info">
            <Icon name="repeat" />
            <span>Gleich folgt eine ähnliche Kontrollaufgabe. So prüfst du sofort, ob die Methode jetzt sitzt.</span>
          </div>
        ) : null}
        {lessonIds.length ? <KursLinks ids={lessonIds} titel="Im Kurs vertiefen" kompakt /> : null}
        {r.uebersteuerbar && !b.antwortOk && b.regelOk && !b.overridden ? (
          <div className="row wrap" style={{ gap: 16 }}>
            <button className="btn small ghost" onClick={onOverride} title="Nur wählen, wenn deine Fassung ebenfalls korrekt ist">
              Meine Fassung ist auch richtig
            </button>
          </div>
        ) : null}
        <div className="actions" style={{ marginTop: 4 }}>
          <button className="btn primary" onClick={onNext} autoFocus>
            {b.last ? 'Abschließen' : 'Weiter'} <span className="kbd">↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Abschluss ----------

function Ergebnis() {
  const data = useApp();
  const l = data.schwaechen.letzte!;
  const sitz = l.sitzung;
  const richtig = sitz.ergebnisse.filter((e) => e.richtig).length;
  const st = sitz.kat ? katStand(data.schwaechen, sitz.kat) : undefined;
  const k = sitz.kat ? kategorie(sitz.kat) : undefined;
  const fehlerKats = [...new Set(sitz.ergebnisse.filter((e) => !e.richtig && e.kat !== 'T').map((e) => e.kat))];
  const neu = (fn: () => Promise<boolean>) => void fn();

  return (
    <div className="practice">
      <main className="practice-body summary">
        <div className="eyebrow">{sitz.titel}</div>
        <h1 style={{ marginTop: 6 }}>{st?.stufe === 4 && l.meldung.includes('gemeistert') ? 'Kategorie gemeistert' : 'Training abgeschlossen'}</h1>
        <div className="card" style={{ marginTop: 24 }}>
          <div className="stat">
            <span className="value">
              {richtig} von {sitz.ergebnisse.length}
            </span>
            <span className="label">mit Antwort und Begründung richtig</span>
          </div>
          <p className="muted" style={{ marginTop: 12 }} data-meldung>
            {l.meldung}
          </p>
          {st && k ? (
            <p className="small" style={{ marginTop: 12 }}>
              <AmpelBadge stand={st} /> {k.titel}: {STUFE_TEXT[st.stufe]}
            </p>
          ) : null}
        </div>
        {fehlerKats.length && sitz.art !== 'kategorie' ? (
          <div className="section">
            <h2>Fehler in diesen Kategorien</h2>
            <div className="list">
              {fehlerKats.map((x) => (
                <a key={x} className="list-item" href={`#/schwaechen/kat/${x}`}>
                  <span className="grow">
                    <span className="title-line">{kategorie(x)?.titel}</span>
                    <span className="sub-line">{kategorie(x)?.kurz}</span>
                  </span>
                  <Icon name="chevronRight" className="chev" />
                </a>
              ))}
            </div>
          </div>
        ) : null}
        <div className="actions" style={{ marginTop: 28, justifyContent: 'flex-start' }}>
          {sitz.art === 'kategorie' ? (
            <>
              <button className="btn primary" onClick={() => neu(starteMisch)} autoFocus>
                Weiter: alle Kategorien gemischt
              </button>
              <button className="btn" onClick={() => neu(() => starteKategorie(sitz.kat!))}>
                Kategorie noch einmal
              </button>
            </>
          ) : sitz.art === 'misch' ? (
            <button className="btn primary" onClick={() => neu(starteTransfer)} autoFocus>
              Weiter: Transfer-Absätze
            </button>
          ) : (
            <button className="btn primary" onClick={() => neu(starteMisch)} autoFocus>
              Alle Kategorien gemischt
            </button>
          )}
          <a className="btn" href="#/schwaechen">
            Zur Übersicht
          </a>
        </div>
      </main>
    </div>
  );
}

/** Erklärung oben rechts: Methode, Regeln und Regelkarten der Kurse; ohne Kategorie alle Methoden im Überblick. */
function SwErklaerung({ kats, regelnZeigen }: { kats: string[]; regelnZeigen: boolean }) {
  if (!kats.length) {
    return (
      <div className="list" data-erklaerung-art="alle">
        {KATEGORIEN.map((k) => (
          <div key={k.id} className="list-item">
            <span className="grow">
              <span className="title-line">{k.titel}</span>
              <span className="sub-line">{typo(k.methode)}</span>
            </span>
          </div>
        ))}
        <p className="small muted" style={{ marginTop: 8 }}>
          Im gemischten Training verrät die Erklärung zur Kategorie die Lösung. Sie erscheint deshalb erst nach deiner Antwort.
        </p>
      </div>
    );
  }
  return (
    <div data-erklaerung-art={kats.join(',')}>
      {kats.map((id) => {
        const k = kategorie(id);
        if (!k) return null;
        const lessons = k.kurse.map((x) => getLesson(x)).filter((l): l is NonNullable<typeof l> => !!l);
        return (
          <div key={id} style={{ marginBottom: 20 }}>
            {kats.length > 1 ? <h3>{k.titel}</h3> : null}
            <div className="fb-label">Die Methode</div>
            <p className="sw-methode">{typo(k.methode)}</p>
            {regelnZeigen ? (
              <>
                <div className="fb-label" style={{ marginTop: 14 }}>
                  Regeln
                </div>
                <ul className="zs-schrittliste">
                  {k.regeln.map((r) => (
                    <li key={r.id}>{typo(r.text)}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="small muted">Die Regeln der Kategorie siehst du nach deiner Wahl der Begründung.</p>
            )}
            {lessons.map((l) => (
              <div key={l.id} style={{ marginTop: 16 }}>
                <div className="fb-label">
                  Regelkarte {l.id} {l.titel}
                </div>
                <RuleCard karte={l.regelkarte} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
